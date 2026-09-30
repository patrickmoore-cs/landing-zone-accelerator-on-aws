/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import { describe, it, expect } from 'vitest';
import * as cdk from 'aws-cdk-lib';
import { getStackSynthesizer } from '../utils/stack-utils';
import { AcceleratorStackProps } from '../lib/stacks/accelerator-stack';

const managementAccountId = '111111111111';
const accountId = '222222222222';
const region = 'eu-west-1';

function buildProps(cdkOptions: Record<string, unknown> = {}): AcceleratorStackProps {
  return {
    partition: 'aws',
    accountsConfig: {
      getManagementAccountId: () => managementAccountId,
    },
    globalConfig: {
      cdkOptions,
    },
    prefixes: {
      accelerator: 'AWSAccelerator',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as AcceleratorStackProps;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function synthesizerProps(synthesizer: any) {
  return synthesizer.props;
}

describe('getStackSynthesizer', () => {
  it('falls back to CDK default bootstrap roles when no cdkOptions flag or override is set', () => {
    const synthesizer = getStackSynthesizer(buildProps(), accountId, region);

    expect(synthesizer).toBeInstanceOf(cdk.DefaultStackSynthesizer);
    const props = synthesizerProps(synthesizer);
    expect(props.qualifier).toBe('accel');
    expect(props.cloudFormationExecutionRole).toBeUndefined();
    expect(props.deployRoleArn).toBeUndefined();
    expect(props.fileAssetPublishingRoleArn).toBeUndefined();
  });

  it('falls back to the accelerator prefix Deployment-Role in the management account when nothing else is configured', () => {
    // The Installer's bootstrap-management.sh always applies the custom template to the management
    // account, unconditionally, so that role exists there even with no cdkOptions flag set.
    const synthesizer = getStackSynthesizer(buildProps(), managementAccountId, region);

    expect(synthesizer).toBeInstanceOf(cdk.DefaultStackSynthesizer);
    const props = synthesizerProps(synthesizer);
    expect(props.deployRoleArn).toBe(`arn:aws:iam::${managementAccountId}:role/AWSAccelerator-Deployment-Role`);
    expect(props.cloudFormationExecutionRole).toBe(
      `arn:aws:iam::${managementAccountId}:role/AWSAccelerator-Deployment-Role`,
    );
  });

  it('uses CliCredentialsStackSynthesizer when useManagementAccessRole is set', () => {
    const synthesizer = getStackSynthesizer(buildProps({ useManagementAccessRole: true }), accountId, region);

    expect(synthesizer).toBeInstanceOf(cdk.CliCredentialsStackSynthesizer);
  });

  it('uses customDeploymentRole from cdkOptions when no explicit override is passed', () => {
    const synthesizer = getStackSynthesizer(
      buildProps({ customDeploymentRole: 'MyCustomRole', useManagementAccessRole: true }),
      accountId,
      region,
    );

    expect(synthesizer).toBeInstanceOf(cdk.DefaultStackSynthesizer);
    const props = synthesizerProps(synthesizer);
    expect(props.deployRoleArn).toBe(`arn:aws:iam::${accountId}:role/MyCustomRole`);
    expect(props.qualifier).toBe('accel');
  });

  it('prefers an explicit deploymentRoleName override over every cdkOptions flag', () => {
    const synthesizer = getStackSynthesizer(
      buildProps({ customDeploymentRole: 'MyCustomRole', useManagementAccessRole: true }),
      accountId,
      region,
      'AWSAccelerator-Management-Deployment-Role',
    );

    expect(synthesizer).toBeInstanceOf(cdk.DefaultStackSynthesizer);
    const props = synthesizerProps(synthesizer);
    expect(props.deployRoleArn).toBe(`arn:aws:iam::${accountId}:role/AWSAccelerator-Management-Deployment-Role`);
    expect(props.cloudFormationExecutionRole).toBe(
      `arn:aws:iam::${accountId}:role/AWSAccelerator-Management-Deployment-Role`,
    );
    expect(props.fileAssetPublishingRoleArn).toBe(
      `arn:aws:iam::${accountId}:role/AWSAccelerator-Management-Deployment-Role`,
    );
  });

  it('centralizes the asset bucket per-account when centralizeBuckets is set', () => {
    const synthesizer = getStackSynthesizer(buildProps({ centralizeBuckets: true }), accountId, region);

    const props = synthesizerProps(synthesizer);
    expect(props.bucketPrefix).toBe(`${accountId}/`);
    expect(props.fileAssetsBucketName).toBe(`cdk-accel-assets-${managementAccountId}-${region}`);
  });

  it('does not centralize the asset bucket when no centralizeBuckets flag is set', () => {
    const synthesizer = getStackSynthesizer(buildProps(), accountId, region);

    const props = synthesizerProps(synthesizer);
    expect(props.bucketPrefix).toBeUndefined();
    expect(props.fileAssetsBucketName).toBeUndefined();
  });
});
