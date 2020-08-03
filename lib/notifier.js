const notifier = require('node-notifier');
const { config } = require('./config');
const telegramBot = require('./telegram-bot');
const _ = require('lodash');
const cache = {businessesById:{}};
const cacheLocalizationValues = {values:{}};
const { of, combineLatest } = require('rxjs');
const { map } = require('rxjs/operators');


module.exports = {
    hasListeners$,
    notifyIfChanged,
    notifyOnLocalization
};

/* === NOTIFICATION MANAGER === */
function hasListeners$(){
    const options = config.get('notifications');
    return combineLatest(
        of(options.console.enabled),
        of(options.desktop.enabled),
        telegramBot.hasActiveChats$()
    ).pipe(
        map(enabledItems => _.some(enabledItems))
    );
}
// Sending notif when one of your favorite quantity is > 0
function notifyIfChanged(businesses) {
    const businessesById = _.keyBy(businesses, 'item.item_id');
    const filteredBusinesses = filterBusinesses(businessesById);

    const message = createMessage(filteredBusinesses);
    const options = config.get('notifications');

    if(options.console.enabled){
        notifyConsole(message, options.console);
    }
    if(filteredBusinesses.length > 0){
        if(options.desktop.enabled){
            notifyDesktop(message)
        }
        if(options.telegram.enabled){
            telegramBot.notify(message);
        }
    }

    cache.businessesById = businessesById;
}

// Sending notif when you send your localization, only on the ranking 4/5 around you
function notifyOnLocalization(businesses) {
    const businessesById = _.keyBy(businesses, 'item.item_id');
    const filteredBusinesses = filterBusinessesByRating(businessesById);
    const message = createMessage(filteredBusinesses);
    const options = config.get('notifications');
    console.log("Number of items, and number of items cached:")
    console.log(Object.keys(filteredBusinesses).length);
    console.log(Object.keys(cacheLocalizationValues.values).length);
    // Notification sent if any changes occurs
    if (Object.keys(filteredBusinesses).length != Object.keys(cacheLocalizationValues.values).length)
    {
        if(options.console.enabled){
            notifyConsole(message, options.console);
        }
        if(filteredBusinesses.length > 0){
            if(options.desktop.enabled){
                notifyDesktop(message)
            }
            if(options.telegram.enabled){
                telegramBot.notify(message);
            }
        }
    }
    cacheLocalizationValues.values = filteredBusinesses;
}
/* === END === */


/* === FILTERING ===*/
// Can reach the best markets by checking reviews
function filterBusinessesByRating(businessesById) {
    return Object.keys(businessesById)
      .filter(key => 
        businessesById[key]?.item.badges[0]?.rating_group === 'LOVED' &&
        businessesById[key]?.item.badges[1]?.rating_group === 'LOVED' &&
        businessesById[key]?.item.badges[2]?.rating_group === 'LOVED' &&
        businessesById[key]?.item.badges[3]?.rating_group === 'LOVED')
      .map(key => businessesById[key]);
  }

// Same as before, but check only one value. -> Not implemented yet.
function filterBusinessesByRating2(businessesById) {
    // Result: [], [], [{...}], [], [{...}],...
    const resultFilter = obj.items.
    map(key => key.item.badges.
    filter(key => key.badge_type === "OVERALL_RATING_TRUST_SCORE" && key.rating_group === "LOVED")).map(key => key)
    const finalArray = [];
    // Compare the resultFilter and the full object
    for (i = 0; i < res.length; i++) {
        if (res[i].length > 0) {
          final.push(obj.items[i].store.store_name)
        }
      }
    // A modifier car il faut renvoyer des ID et nous renvoyons ici des objects. Donc descendre dans les IDS.
    return finalArray;
}

function filterBusinesses(businessesById) {
    return Object.keys(businessesById)
        .filter(key => {
            const current = businessesById[key];
            const previous = cache.businessesById[key];
            return hasInterestingChange(current, previous);
        })
        .map(key => businessesById[key]);
}

function hasInterestingChange(current, previous) {
    const options = config.get('messageFilter');

    const currentStock = current.items_available;
    const previousStock = previous ? previous.items_available : 0;

    if (currentStock === previousStock) {
        return options.showUnchanged;
    } else if(currentStock === 0){
        return options.showDecreaseToZero;
    } else if (currentStock < previousStock) {
        return options.showDecrease;
    } else if (previousStock === 0) {
        return options.showIncreaseFromZero;
    } else {
        return options.showIncrease;
    }
}

function hasInterestingChangeForLocalization(current, previous) {
    const options = config.get('messageFilter');

    const currentID = current.store.store_id;
    const previousID = previous ? previous.store.store_id : 0;

    if (currentID === previousID) {
        return false;
    } else {

    } 
}
/* === END === */


/* === MESSAGE === */
function createMessage(businesses){
    return businesses
        .sort(function(a, b){
            // console.log(a?.item.favorite_count)
            // console.log(a?.store.store_name)
            // console.log(b?.item.favorite_count)
            // console.log(b?.store.store_name)
            return b?.item?.favorite_count - a?.item?.favorite_count
        })
        .map(business => `${ business.display_name } - ${business.items_available} restant(s)`)
        .join('\n');
}

function notifyConsole(message, options){
    if(options.clear){
        console.clear();
    }
    console.log(message + '\n');
}

function notifyDesktop(message){
    notifier.notify({ title: 'TooGoodToGo', message });
}
/* === END === */

