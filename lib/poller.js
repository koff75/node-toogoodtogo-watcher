/* eslint-disable camelcase */
/* eslint-disable require-jsdoc */
const _ = require("lodash")
const { iif, from, of, combineLatest, timer } = require("rxjs")
const { mergeMap, filter, map, retry, catchError } = require("rxjs/operators")
const { config } = require("./config")
const api = require("./api")

const MINIMAL_POLLING_INTERVAL = 15000
const MINIMAL_AUTHENTICATION_INTERVAL = 3600000

module.exports = {
  pollBusinesses$,
}

function pollBusinesses$(enabled$, favorite_only) {
  const authenticationByInterval$ = authenticateByInterval$()
  return listFavoriteBusinessesByInterval$(
    authenticationByInterval$,
    enabled$,
    favorite_only
  )
}

function authenticateByInterval$() {
  const authenticationIntervalInMs = getInterval(
    "api.authenticationIntervalInMS",
    MINIMAL_AUTHENTICATION_INTERVAL
  )

  return timer(0, authenticationIntervalInMs).pipe(
    mergeMap(() =>
      from(api.login()).pipe(
        retry(2),
        catchError(logError),
        filter(authentication => !!authentication)
      )
    )
  )
}

function listFavoriteBusinessesByInterval$(
  authenticationByInterval$,
  enabled$,
  favorite_only
) {
  const pollingIntervalInMs = getInterval(
    "api.pollingIntervalInMs",
    MINIMAL_POLLING_INTERVAL
  )

  return combineLatest(
    enabled$,
    timer(0, pollingIntervalInMs),
    authenticationByInterval$
  ).pipe(
    mergeMap(v =>
      iif(
        () => pollingStatus(favorite_only), // -> to know which poll to stop
        of(v)
      )
    ),
    //filter(([enabled]) => enabled),
    mergeMap(() =>
      from(api.listBusinesses(favorite_only)).pipe(
        retry(2),
        catchError(logError),
        filter(response => !!_.get(response, "items")),
        map(response => response.items)
      )
    )
  )
}

function logError(error) {
  if (error.options) {
    console.error(`Error during request:
${error.options.method} ${error.options.url.toString()}
${JSON.stringify(error.options.json, null, 4)}
${error.stack}`)
  } else if (error.stack) {
    console.error(error.stack)
  } else {
    console.error(error)
  }
  return of(null)
}

function getInterval(configPath, minimumIntervalInMs) {
  const configuredIntervalInMs = config.get(configPath)
  return _.isFinite(configuredIntervalInMs)
    ? Math.max(configuredIntervalInMs, minimumIntervalInMs)
    : minimumIntervalInMs
}

function pollingStatus(favorite_only) {
  if (favorite_only === true) {
    const pollingStatus = config.get("notifications.pollingFav")
    // telegramBot.notify(`PollFav à ${pollingStatus}`);
    return pollingStatus
  } else {
    const pollingStatus = config.get("notifications.pollingLoc")
    // telegramBot.notify(`PollLoc à ${pollingStatus}`);
    return pollingStatus
  }
}
