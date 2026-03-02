// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../core/resource';
import * as PoliciesAPI from './policies';
import {
  Policies,
  PolicyEnforceParams,
  PolicyEnforceResponse,
  PolicyEnforcementResultAction,
} from './policies';

export class Organizations extends APIResource {
  policies: PoliciesAPI.Policies = new PoliciesAPI.Policies(this._client);
}

Organizations.Policies = Policies;

export declare namespace Organizations {
  export {
    Policies as Policies,
    type PolicyEnforcementResultAction as PolicyEnforcementResultAction,
    type PolicyEnforceResponse as PolicyEnforceResponse,
    type PolicyEnforceParams as PolicyEnforceParams,
  };
}
