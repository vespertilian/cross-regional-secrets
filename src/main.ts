import * as lambda from '@aws-cdk/aws-lambda';
import * as secrets from '@aws-cdk/aws-secretsmanager';
import * as ssm from '@aws-cdk/aws-ssm';
import { App, CfnOutput, Construct, Stack, StackProps } from '@aws-cdk/core';
import { RemoteParameters } from 'cdk-remote-stack';

/**
 * This stack creates the secrets in Primary region
 */
export class SecretStack extends Stack {
  readonly secretName: string;
  readonly secret: secrets.Secret;
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    this.secretName = 'AuthToken';

    this.secret = new secrets.Secret(this, 'MySecret', {
      secretName: this.secretName,
    });
    this.secret.addReplicaRegion('us-east-1');

    // write into the ssm parameter store
    const parameter = new ssm.StringParameter(this, 'secretParameter', {
      parameterName: `/${Stack.of(this).stackName}/${this.secretName}`,
      stringValue: this.secret.secretArn,
    });

    new CfnOutput(this, 'SecretArnOutput', { value: this.secret.secretArn });
    new CfnOutput(this, 'SecretNameOutput', { value: this.secret.secretName });
    new CfnOutput(this, 'SecretFullArnOutput', { value: this.secret.secretFullArn! });
    new CfnOutput(this, 'SecretParameterName', { value: parameter.parameterName });
    // define resources here...
  }
}

export interface AppStackProps extends StackProps {
  readonly secretStack: SecretStack;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const remoteParameters = new RemoteParameters(this, 'RemoteParam', {
      path: `/${props.secretStack.stackName}`,
      region: `${props.secretStack.region}`,
    });
    const stackName = props.secretStack.stackName;
    const secretName = props.secretStack.secretName;
    const secretFullArn = remoteParameters.get(`/${stackName}/${secretName}`);
    const importedSecret = secrets.Secret.fromSecretCompleteArn(this, 'ImportedSecret', secretFullArn);

    new CfnOutput(this, 'importedSecretArnOutput', { value: importedSecret.secretArn });

    this.createLambdaTestSecret(props.secretStack.secret, props.env?.region!);
  }

  createLambdaTestSecret(secret: secrets.Secret, region: string): void {
    const lambdaFunc = new lambda.Function(this, 'LambdaTestSecret', {
      code: lambda.Code.fromInline(`
import boto3
import json
from botocore.exceptions import ClientError

def lambda_handler(events, context):
    secret_name = "${secret.secretName}"
    region_name = "${region}"

    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name,
    )

    try:
        get_secret_value_response = client.get_secret_value(
            SecretId=secret_name
        )
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceNotFoundException':
            print("The requested secret " + secret_name + " was not found")
        elif e.response['Error']['Code'] == 'InvalidRequestException':
            print("The request was invalid due to:", e)
        elif e.response['Error']['Code'] == 'InvalidParameterException':
            print("The request had invalid params:", e)
        elif e.response['Error']['Code'] == 'DecryptionFailure':
            print("The requested secret can't be decrypted using the provided KMS key:", e)
        elif e.response['Error']['Code'] == 'InternalServiceError':
            print("An error occurred on service side:", e)
    else:
        # Secrets Manager decrypts the secret value using the associated KMS CMK
        # Depending on whether the secret was a string or binary, only one of these fields will be populated
        if 'SecretString' in get_secret_value_response:
            text_secret_data = get_secret_value_response['SecretString']
            print("text_secret_data:" + text_secret_data)
        else:
            binary_secret_data = get_secret_value_response['SecretBinary']
            print("binary_secret_data:" + binary_secret_data)
     `),
      handler: 'index.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_7,
    });

    const secretInRegion = secrets.Secret.fromSecretNameV2(this, `secret${region}`, secret.secretName);
    secretInRegion.grantRead(lambdaFunc);

    new CfnOutput(this, 'secretFromSecretNameV2Arn', { value: secretInRegion.secretArn });
    if (secretInRegion.secretFullArn) {
      new CfnOutput(this, 'secretFromSecretNameV2FullArn', { value: secretInRegion.secretFullArn });
    }
  }
}

const secretEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-northeast-1',
};

const appJPEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-northeast-1',
};

const appUSEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const app = new App();

const secretStack = new SecretStack(app, 'my-secret-stack', { env: secretEnv } );

// create the app stack in JP
const appJP = new AppStack(app, 'my-app-stack-jp', {
  env: appJPEnv,
  secretStack: secretStack,
});

// create the app stack in US
const appUS = new AppStack(app, 'my-app-stack-us', {
  env: appUSEnv,
  secretStack: secretStack,
});

appJP.addDependency(secretStack);
appUS.addDependency(secretStack);

app.synth();