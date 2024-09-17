import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { S3StaticWebsiteOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class AwsWebshopStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 bucket for static website
    const websiteBucket = new Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront distribution for S3 bucket
    const distribution = new Distribution(this, 'WebsiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new S3StaticWebsiteOrigin(websiteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // Deploy static website files to S3 bucket
    new BucketDeployment(this, 'DeployWebsite', {
      sources: [Source.asset('./website-dist')],
      destinationBucket: websiteBucket,
      distribution: distribution,
      distributionPaths: ['/*'],
    });

    // Create DynamoDB table for products
    const productsTable = new dynamodb.Table(this, 'ProductsTable', {
      tableName: 'products',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },  // Partition key
      removalPolicy: RemovalPolicy.DESTROY,  // Removes the table when stack is destroyed (good for dev)
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,  // Use on-demand billing
    });

    // listProducts
    const listProductsLambda = new lambda.Function(this, 'listProducts', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../src/listProducts'),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
      }
    });

    // getProduct
    const getProductLambda = new lambda.Function(this, 'getProduct', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../src/getProduct'),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
      }
    });

    // Grant Lambda function permissions to read/write to DynamoDB table
    productsTable.grantReadWriteData(listProductsLambda);

    // Create an API Gateway connected to the Lambda function
    const api = new apigateway.LambdaRestApi(this, 'WebshopApi', {
      handler: listProductsLambda,
      proxy: false,
    });

    // Add /products route to the API
    const products = api.root.addResource('products');
    products.addMethod('GET');  // GET /products will trigger the Lambda function

    // Output the CloudFront and API Gateway URLs
    new CfnOutput(this, 'CloudFrontURL', {
      value: distribution.distributionDomainName,
      description: 'The CloudFront URL of the static website',
    });

    new CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'The API Gateway URL to access the webshop API',
    });
  }
}
