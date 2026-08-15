//#region src/shared.ts
/** Poll interval contract of {@link GithubPluginSettings.pollSeconds}. */
const GITHUB_POLL_SECONDS_MIN = 60;
const GITHUB_POLL_SECONDS_MAX = 300;
const GITHUB_POLL_SECONDS_DEFAULT = 60;
//#endregion
export { GITHUB_POLL_SECONDS_DEFAULT, GITHUB_POLL_SECONDS_MAX, GITHUB_POLL_SECONDS_MIN };
