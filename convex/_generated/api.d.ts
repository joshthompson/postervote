/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bradleyTerry from "../bradleyTerry.js";
import type * as competitions from "../competitions.js";
import type * as crons from "../crons.js";
import type * as migrations from "../migrations.js";
import type * as posters from "../posters.js";
import type * as results from "../results.js";
import type * as shared from "../shared.js";
import type * as stats from "../stats.js";
import type * as tally from "../tally.js";
import type * as votes from "../votes.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bradleyTerry: typeof bradleyTerry;
  competitions: typeof competitions;
  crons: typeof crons;
  migrations: typeof migrations;
  posters: typeof posters;
  results: typeof results;
  shared: typeof shared;
  stats: typeof stats;
  tally: typeof tally;
  votes: typeof votes;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
