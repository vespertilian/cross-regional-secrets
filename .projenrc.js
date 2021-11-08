const { AwsCdkTypeScriptApp, Gitpod } = require('projen');
const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.95.2',
  defaultReleaseBranch: 'main',
  name: 'cross-regional-secrets',
  cdkDependencies: [
    '@aws-cdk/aws-secretsmanager',
    '@aws-cdk/aws-ssm',
    '@aws-cdk/aws-lambda',
  ],
  deps: [
    'cdk-remote-stack',
  ],
  devDeps: [
    '@aws-cdk/core',
  ],
});

project.package.addField('resolutions', {
  'pac-resolver': '^5.0.0',
  'set-value': '^4.0.1',
  'ansi-regex': '^5.0.1',
});

let gitpod = new Gitpod(project, {
  prebuilds: {
    addCheck: true,
    addBadge: true,
    addLabel: true,
    branches: true,
    pullRequests: true,
    pullRequestsFromForks: true,
  },
});

/* spellchecker: disable */
gitpod.addVscodeExtensions(
  'https://github.com/neilkuan/vscode-eslint/releases/download/release%2F2.2.2/vscode-eslint-2.2.2.vsix',
);


project.synth();