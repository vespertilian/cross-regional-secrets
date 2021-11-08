const { AwsCdkTypeScriptApp } = require('projen');
const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.95.2',
  defaultReleaseBranch: 'main',
  name: 'cross-regional-secrets',
  cdkDependencies: [
    '@aws-cdk/aws-secretsmanager',
  ],
  devDeps: [
    '@aws-cdk/core',
  ],
});
project.synth();