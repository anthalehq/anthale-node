// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import type { Anthale } from '../client';

export abstract class APIResource {
  protected _client: Anthale;

  constructor(client: Anthale) {
    this._client = client;
  }
}
