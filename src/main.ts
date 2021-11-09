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
      code: lambda.Code.fromAsset('lambda'),
      handler: 'hello-world.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
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
  region: 'ap-southeast-1',
};

const appJPEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-southeast-2',
};

const appUSEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const app = new App();

const secretStack = new SecretStack(app, 'my-secret-stack', { env: secretEnv } );

// create the app stack in JP
const appJP = new AppStack(app, 'my-app-stack-au', {
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
