import { App, CfnOutput, Construct, Stack, StackProps } from '@aws-cdk/core';
import * as secrets from '@aws-cdk/aws-secretsmanager'

/**
 * This stack creates the secrets in Primary region
 */
export class SecretStack extends Stack {
  readonly secretFullArn: string;
  readonly secret: secrets.Secret;
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const secretName = 'AuthToken'

    this.secret = new secrets.Secret(this, 'MySecret', {
      secretName,
    })
    this.secret.addReplicaRegion('us-east-1');
    this.secretFullArn = this.secret.secretArn
  
    new CfnOutput(this, 'SecretArnOutput', { value: this.secret.secretArn })
    new CfnOutput(this, 'SecretNameOutput', { value: this.secret.secretName })
    new CfnOutput(this, 'SecretFullArnOutput', { value: this.secret.secretFullArn! })
    // define resources here...
  }
}

/**
 * The App stack. 
 */
export interface AppStackProps extends StackProps {
  readonly secretFullArn: string;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    console.log('importing', props.secretFullArn)
    const importedSecret = secrets.Secret.fromSecretCompleteArn(this, 'ImportedSecret', props.secretFullArn)

    new CfnOutput(this, 'importedSecretArnOutput', { value: importedSecret.secretArn })
  }
}

const secretEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'ap-northeast-1'
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

const secretStack = new SecretStack(app, 'my-secret-stack', {env: secretEnv } )

// create the app stack in JP
new AppStack(app, 'my-app-stack-jp', { 
  env: appJPEnv,
  secretFullArn: secretStack.secretFullArn,
});

// create the app stack in US
new AppStack(app, 'my-app-stack-us', { 
  env: appUSEnv,
  secretFullArn: secretStack.secretFullArn,
});

app.synth();