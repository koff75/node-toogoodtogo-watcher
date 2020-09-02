/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
const _ = require("lodash")
const { Telegraf, Extra } = require("telegraf")
const { config } = require("./config")
const { BehaviorSubject } = require("rxjs")
const { map, distinctUntilChanged } = require("rxjs/operators")

const numberOfActiveChats$ = new BehaviorSubject(getNumberOfActiveChats())
const cache = {}
const bot = createBot()

const newUserID$ = new BehaviorSubject("1111")

module.exports = {
  hasActiveChats$,
  notify,
  getUserID$,
}

function getUserID$() {
  return newUserID$
}

function hasActiveChats$() {
  return numberOfActiveChats$.pipe(
    map(numberOfActiveChats => {
      numberOfActiveChats > 0 && isEnabled()
      console.log(`Number active active chat: ${numberOfActiveChats}`)
    }),
    distinctUntilChanged()
  )
}

function notify(message) {
  cache.message = message
  const chats = getChats()
  _.forEach(chats, chat => sendMessage(chat.id, message))
}

function sendMessage(chatId, message) {
  return bot.telegram.sendMessage(chatId, message).catch(error => {
    if (error.code === 403) {
      removeChat(chatId)
    } else {
      console.error(`${error.code} - ${error.description}`)
    }
  })
}

function createBot() {
  const botToken = getBotToken()
  if (!isEnabled() || !botToken) {
    return null
  }
  const bot = new Telegraf(botToken)
  bot.command("startFav", startFavCommand)
  bot.command("stopFav", stopFavCommand)
  bot.command("stopLoc", stopLocCommand)
  bot.command("stop", stopAll)
  bot.command("help", helpCommand)
  bot.command("status", status)

  bot.command("start", ctx => {
    addChat(ctx)
    return ctx.reply(
      "Welcome =) Bot activated !",
      Extra.markup(markup => {
        return markup.resize().keyboard([
          ["🔍 Scan your favorites", "✋ Stop"],
          [markup.locationRequestButton("🚩Scan around me"), "✋Stop"],
          ["💁‍♂️ Help", "📢 Status", "🚨Stop all"],
        ])
      })
    )
  })

  bot.hears("🔍 Scan your favorites", startFavCommand)
  bot.hears("✋ Stop", stopFavCommand)
  bot.hears("✋Stop", stopLocCommand)
  bot.hears("💁‍♂️ Help", helpCommand)
  bot.hears("📢 Status", status)
  bot.hears("🚨Stop all", stopAll)

  bot.on("location", localization) // Update the location & start the grabbing
  bot.on("sticker", ctx => ctx.reply("👍")) // For fun...

  bot.start(ctx => ctx.reply("Welcome ! Click on /start !"))
  bot.help(ctx => ctx.reply("Send me a sticker"))

  bot.launch()
  return bot
}

function localization(context) {
  addChat(context)
  context.reply(`Your position is located.`)
  context
    .reply(
      `You subscribe to be notified when a top ranking market has products so sell.`
    )
    .then(() => sendMessage(context.chat.id, cache.message))

  config.set("notifications.pollingLoc", true)
  config.set("localization.latitude", context.update.message.location.latitude)
  config.set(
    "localization.longitude",
    context.update.message.location.longitude
  )
}

/* === Command function === */
function startFavCommand(context) {
  addChat(context)
  context
    .reply(
      `Copy that !
        To stop the notifications, just send me this message:
        /stopFav`
    )
    .then(() => sendMessage(context.chat.id, cache.message))
  config.set("notifications.pollingFav", true)
}

function stopFavCommand(context) {
  context.reply(`Stopping grabbing on your favorites... To start again press:
/startFav`)
  // removeChat(context.chat.id);
  config.set("notifications.pollingFav", false)
}

function stopLocCommand(context) {
  context.reply(
    `Stopping grabbing on your location... To start again, just send me your location !`
  )
  // removeChat(context.chat.id);
  config.set("notifications.pollingLoc", false)
}

function stopAll(context) {
  context.reply(
    `Stopping everything & stopping telegram notifications ! /help if needed.`
  )
  removeChat(context.chat.id)
  config.set("notifications.pollingLoc", false)
  config.set("notifications.pollingFav", false)
}

function helpCommand(context) {
  context.reply(` Hi ! I'm your dedicated bot :)
/startFav to have me notify you only for your favorites markets
send me your location</b> to update me you location, and start the notification on the top ranking markets around you
/stopFav to stop scanning your favorites markets until you re /startFav me
/stopLoc to stop scanning your top markets around you until sending your localization`)
}

function status(context) {
  const pollingFav = config.get("notifications.pollingFav")
  const pollingLoc = config.get("notifications.pollingLoc")
  context.reply(`Status: 
        favorites => ${pollingFav ? "activated" : "disabled"}
        localization => ${pollingLoc ? "activated" : "disabled"}
    `)
}
/* === End === */

/* === Chat manager === */
function addChat(context) {
  const chats = getChats()
  const chat = {
    id: context.chat.id,
    firstName: context.from.first_name,
    lastName: context.from.last_name,
  }
  config.set(
    "notifications.telegram.chats",
    _.unionBy(chats, [chat], chat => chat.id)
  )
  console.log(`Added chat ${chat.firstName} ${chat.lastName} (${chat.id})`)
  emitNumberOfActiveChats()

  newUserID$.next(chat.id)
}

function removeChat(chatId) {
  const chats = getChats()
  const chat = _.find(chats, { id: chatId })
  if (chat) {
    config.set("notifications.telegram.chats", _.pull(chats, chat))
    console.log(`Removed chat ${chat.firstName} ${chat.lastName} (${chat.id})`)
  }
  emitNumberOfActiveChats()
}
/* === End === */

/* === Get Config param === */
function emitNumberOfActiveChats() {
  numberOfActiveChats$.next(getNumberOfActiveChats())
}

function isEnabled() {
  return !!config.get("notifications.telegram.enabled")
}

function getChats() {
  return config.get("notifications.telegram.chats")
}

function getBotToken() {
  return config.get("notifications.telegram.botToken")
}

function getNumberOfActiveChats() {
  const chats = config.get("notifications.telegram.chats")
  return _.size(chats)
}
/* === End === */
