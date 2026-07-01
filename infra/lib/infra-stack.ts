import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================================================================
    // Storage Resources
    // =========================================================================

    const rawLogsBucket = new s3.Bucket(this, 'RawParticleLogsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const logEventsTable = new dynamodb.Table(this, 'ParticleLogEventsTable', {
      partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventTime', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // =========================================================================
    // Lambda Function (handles both ingestion and query)
    // =========================================================================

    const ingestionFunction = new NodejsFunction(this, 'ParticleLogIngestionFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../lambda/src/handler.ts'),
      timeout: Duration.seconds(10),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        minify: false,
        sourceMap: true,
        target: 'es2022',
        externalModules: [],
        forceDockerBundling: false,
      },
      depsLockFilePath: path.join(__dirname, '../../lambda/package-lock.json'),
      projectRoot: path.join(__dirname, '../../lambda'),
      environment: {
        RAW_LOGS_BUCKET_NAME: rawLogsBucket.bucketName,
        LOG_EVENTS_TABLE_NAME: logEventsTable.tableName,
        PARTICLE_WEBHOOK_SECRET: 'REMOVED_PARTICLE_WEBHOOK_SECRET',
      },
    });

    // -------------------------------------------------------------------------
    // IAM Permissions (Least Privilege)
    // -------------------------------------------------------------------------

    // Phase 1 + 2A: Ingestion requires S3 write + DynamoDB write
    rawLogsBucket.grantWrite(ingestionFunction);
    logEventsTable.grantWriteData(ingestionFunction);

    // Phase 2B: Query API requires DynamoDB Query only (no S3, no Scan)
    // Grant minimal DynamoDB read permissions for per-device queries
    ingestionFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:Query',           // Required: Per-device time-range queries
        'dynamodb:DescribeTable',   // Optional: Table metadata for SDK
      ],
      resources: [
        logEventsTable.tableArn,
      ],
    }));

    // =========================================================================
    // HTTP API Gateway
    // =========================================================================

    const httpApi = new apigwv2.HttpApi(this, 'ParticleLogIngestionApi', {
      apiName: 'particle-log-ingestion-api',
    });

    // Phase 1 + 2A: Ingestion endpoint (POST /particle/log)
    httpApi.addRoutes({
      path: '/particle/log',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'ParticleLogIngestionIntegration',
        ingestionFunction
      ),
    });

    // Phase 2B: Query API endpoints (GET /device/{deviceId}/...)
    // All query endpoints share the same Lambda handler with internal routing

    // GET /device/{deviceId}/timeline
    httpApi.addRoutes({
      path: '/device/{deviceId}/timeline',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'TimelineQueryIntegration',
        ingestionFunction
      ),
    });

    // GET /device/{deviceId}/health
    httpApi.addRoutes({
      path: '/device/{deviceId}/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'HealthQueryIntegration',
        ingestionFunction
      ),
    });

    // GET /device/{deviceId}/summary
    httpApi.addRoutes({
      path: '/device/{deviceId}/summary',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'SummaryQueryIntegration',
        ingestionFunction
      ),
    });

    // GET /device/{deviceId}/anomalies
    httpApi.addRoutes({
      path: '/device/{deviceId}/anomalies',
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration(
        'AnomaliesQueryIntegration',
        ingestionFunction
      ),
    });

    // =========================================================================
    // CloudFormation Outputs
    // =========================================================================

    new cdk.CfnOutput(this, 'ParticleLogIngestionUrl', {
      value: `${httpApi.apiEndpoint}/particle/log`,
      description: 'Ingestion endpoint (POST)',
    });

    new cdk.CfnOutput(this, 'QueryApiBaseUrl', {
      value: `${httpApi.apiEndpoint}/device`,
      description: 'Query API base URL (GET /device/{deviceId}/...)',
    });

    new cdk.CfnOutput(this, 'RawLogsBucketName', {
      value: rawLogsBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'LogEventsTableName', {
      value: logEventsTable.tableName,
    });
  }
}
