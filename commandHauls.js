/*	twcheese_commandHauls.js
 *	Commands Overview - show returning hauls
 *	market: uk, us, en, {all}
 *	author Nick Toby (cheesasaurus@gmail.com)

 *	use script on: game.php?screen=overview_villages&mode=commands&type=return (the commands overview, with the return filter on)
 *	effect: includes 'haul' as part of the information for the listed commands. Also shows statistics about the incoming resources
 
 *	Copyright (C) 2011  Nick Toby

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see http://www.gnu.org/licenses/
 */

if (!twcheese)
    var twcheese = {};

/*==== graphics ====*/
twcheese.images = {
    plus: 'graphic/plus.png',
    minus: 'graphic/minus.png',
    timber: 'graphic/holz.png',
    clay: 'graphic/lehm.png',
    iron: 'graphic/eisen.png',
    popupBackground: 'graphic/popup/content_background.png',
    popupBorder: 'graphic/popup/border.png',
    servant: 'graphic/paladin_new.png',
    loadingSpinner: 'graphic/throbber.gif'
};

// avoid flooding the server with requests
(function () {

    class RateLimiter {
        constructor(maxBurstsPerSecond) {
            this.maxBurstsPerSecond = maxBurstsPerSecond;
            this.recentRequests = new Array(maxBurstsPerSecond);
        }

        requestWasMade() {
            this.recentRequests.unshift(performance.now());
            this.recentRequests.pop();
        }

        async sleepIfNeeded() {
            let anchorTimestamp = this.recentRequests[this.maxBurstsPerSecond - 1];
            if (typeof anchorTimestamp === 'undefined') {
                return;
            }
            let delayMs = anchorTimestamp + 1000 - performance.now();
            if (delayMs <= 0) {
                return;
            }
            return new Promise(function(resolve, reject) {
                setTimeout(resolve, delayMs);
            });
        }
    }

    twcheese.rateLimiter = new RateLimiter(5);

    let oldSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
        twcheese.rateLimiter.requestWasMade();
        oldSend.apply(this, arguments);
    }

})();

// config
(function() {
    'use strict';

    class Config {
        constructor(id) {
            this.id = id;
            this.props = {};
            this.load();
        }

        load() {
            let saved = localStorage.getItem(this.id);
            if (saved) {
                this.props = JSON.parse(saved);
            }
        }

        save() {
            localStorage.setItem(this.id, JSON.stringify(this.props));
        }

        get(prop, defaultValue) {
            let obj = this.props;
            let tokens = prop.split('.');
            for (let i = 0; i < tokens.length - 1; i++) {
                let token = tokens[i];
                if (typeof obj[token] !== 'object' || token === null) {
                    return defaultValue;
                }
                obj = obj[token];
            }
            return obj[tokens[tokens.length - 1]];
        }

        set(prop, value) {
            let obj = this.props;
            let tokens = prop.split('.');
            for (let i = 0; i < tokens.length - 1; i++) {
                let token = tokens[i];
                if (typeof obj[token] !== 'object' || token === null) {
                    obj[token] = {};
                }
                obj = obj[token];
            }
            obj[tokens[tokens.length - 1]] = value;
            this.save();
        }
    }

    twcheese.userConfig = new Config('twcheese.userConfig');
})();

/*==== timing ====*/

(function() {
    'use strict';

    let serverOffsetFromUtc = window.server_utc_diff * 1000;
    let localOffsetFromUtc = new Date().getTimezoneOffset() * 60000;

    class TwCheeseDate extends Date {
        constructor() {
            if (arguments.length === 0) {
                super(Timing.getCurrentServerTime());
            } else {
                super(...arguments);
            }
        }

        clone() {
            return new TwCheeseDate(this.getTime());
        }

        addDays(days) {
            let ret = this.clone();
            ret.setUTCDate(this.getUTCDate() + days);
            return ret;
        }

        addHours(hours) {
            let ret = this.clone();
            ret.setUTCHours(this.getUTCHours() + hours);
            return ret;
        }

        addMinutes(minutes) {
            let ret = this.clone();
            ret.setUTCMinutes(this.getUTCMinutes() + minutes);
            return ret;
        }

        addSeconds(seconds) {
            let ret = this.clone();
            ret.setUTCSeconds(this.getUTCSeconds() + seconds);
            return ret;
        }

        addMilliseconds(milliseconds) {
            let ret = this.clone();
            ret.setUTCMilliseconds(this.getUTCMilliseconds() + milliseconds);
            return ret;
        }

        subDays(days) {
            return this.addDays(-days);        
        }

        subHours(hours) {
            return this.addHours(-hours);
        }

        subMinutes(minutes) {
            return this.addMinutes(-minutes);
        }

        subSeconds(seconds) {
            return this.addSeconds(-seconds);
        }

        subMilliseconds(milliseconds) {
            return this.addMilliseconds(-milliseconds);
        }

        getServerHours() {
            return this.addMilliseconds(serverOffsetFromUtc).getUTCHours();
        }

        isTodayOnServer() {
            let dateAdjusted = this.addMilliseconds(serverOffsetFromUtc);
            let nowAdjusted = new TwCheeseDate().addMilliseconds(serverOffsetFromUtc);
            return dateAdjusted.isSameDayInUtc(nowAdjusted);
        }

        isTomorrowOnServer() {
            let dateAdjusted = this.addMilliseconds(serverOffsetFromUtc);
            let nowAdjusted = new TwCheeseDate().addMilliseconds(serverOffsetFromUtc);
            let tomorrow = nowAdjusted.addDays(1);    
            return dateAdjusted.isSameDayInUtc(tomorrow);
        }

        isSameDayInUtc(otherDate) {
            return this.getUTCFullYear() === otherDate.getUTCFullYear()
                && this.getUTCMonth() === otherDate.getUTCMonth()
                && this.getUTCDate() === otherDate.getUTCDate();
        }

        startOfHour() {
            let ret = this.clone();
            ret.setUTCMinutes(0);
            ret.setUTCSeconds(0);
            ret.setUTCMilliseconds(0);
            return ret;
        }

        endOfHour() {
            let ret = this.clone();
            ret.setUTCMinutes(59);
            ret.setUTCSeconds(59);
            ret.setUTCMilliseconds(999);
            return ret;
        }
    }


    twcheese.Timing = {

        /**
         * @params whatever would be passed to a Date constructor
         * @return {TwCheeseDate}
         */
        newServerDate() {
            let ret = new TwCheeseDate(...arguments);
            if (arguments.length > 1) {
                ret = ret.addMilliseconds(0 - serverOffsetFromUtc - localOffsetFromUtc);
            }
            return ret;
        },

        monthNumber(monthName) {
            return (new Date(monthName + ' 1 1970')).getMonth();
        }
    };

})();


(function () {

    class Command {
        constructor() {
            this.arrival = twcheese.Timing.newServerDate();
            this.timber = 0;
            this.clay = 0;
            this.iron = 0;
            this.haulCapacity = 0;
        } 

        sumLoot() {
            return this.timber + this.clay + this.iron;
        }

        calcHaulPercent() {
            if (this.haulCapacity === 0) {
                return 0;
            }
            return Math.round(100 * this.sumLoot() / this.haulCapacity);
        }

        arrivesDuring(fromTime, toTime) {
            return this.arrival >= fromTime && this.arrival <= toTime;
        }

        static sumProps(commands) {
            let sum = new Command();

            for (let command of commands) {
                sum.timber += command.timber;
                sum.clay += command.clay;
                sum.iron += command.iron;
                sum.haulCapacity += command.haulCapacity;
            }
            return sum;
        }

        static sumPropsFromTimeframe(commands, fromTime, toTime) {
            let relevantCommands = commands.filter(command => command.arrivesDuring(fromTime, toTime));
            return Command.sumProps(relevantCommands);
        }
    }

    twcheese.Command = Command;

})();

/*==== scraper functions ====*/

/**
 *	scrapes a command page for the command info and returns it as a twcheese_Command object
 *	@param	gameDoc:HTMLDocument	the page generated by game.php?screen=command_info&id=x&type=own
 *	@return command:twcheese_Command	an object representing the command.
 */
twcheese.scrapeCommand = function (gameDoc) {
    var command = new twcheese.Command();

    try {//note: being lazy - catching exception thrown for returning scouts and outgoing troops instead of checking for them
        var content = $(gameDoc).find('#content_value').get()[0];

        var arrivalCell = content.getElementsByTagName('table')[0].rows[6].cells[1];
        command.arrival = twcheese.parseArrival($(arrivalCell).text());

        var resCell = content.getElementsByTagName('table')[2].rows[0].cells[1];
        var haul = twcheese.scrapeResources(resCell);
        command.timber = haul.timber;
        command.clay = haul.clay;
        command.iron = haul.iron;

        var haulText = resCell.innerHTML;
        if (haulText.search('\\|') !== -1) {
            haulText = haulText.substring(haulText.search('\\|') + 7);
            let performance = haulText.split('/');
            command.haulCapacity = parseInt(performance[1]);
        }
    }
    catch (e) {
    }

    return command;
};

/**
 * @param {string} text formatted the way tw does it. e.g. "Jun 12, 2019  15:36:23:000"
 * @return {TwCheeseDate}
 */
twcheese.parseArrival = function (text) {
    // note: some worlds have milliseconds disabled
    let expr = /(\D{3}) (\d{1,2}), (\d{4})  (\d{2}):(\d{2}):(\d{2}):?(\d{3})?/;
    [, monthName, day, year, hours, minutes, seconds, millis] = text.match(expr);
    let month = twcheese.Timing.monthNumber(monthName);
    return twcheese.Timing.newServerDate(year, month, day, hours, minutes, seconds, millis || 0);
};

/**
 *	requests the body from an html document and returns it as an HTML element
 *	@param	{string} targetUrl	the url of the page to get the document body from
 *  @return {Promise}
 *	@resolve {HTMLBodyElement}
 */
twcheese.requestDocumentBody = async function (targetUrl) {
    await twcheese.rateLimiter.sleepIfNeeded();

    return new Promise(function(resolve, reject) {
        var xmlhttp;
        if (window.XMLHttpRequest)
            xmlhttp = new XMLHttpRequest();
        else
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        xmlhttp.open("GET", targetUrl);
        xmlhttp.onload = function() {
            let requestedDocumentBody = document.createElement("body");
            requestedDocumentBody.innerHTML = xmlhttp.responseText;
            resolve(requestedDocumentBody);
        };
        xmlhttp.onerror = function() {
            reject('failed to load ' + targetUrl);
        }
        xmlhttp.send("");
    });
};

 /**
  * @param {HTMLElement} resourcesContainer an element containing timber/clay/iron amounts
  * @return {Object} {timber: timberAmount, clay: clayAmount, iron: ironAmount}
  */
twcheese.scrapeResources = function (resourcesContainer) {
    // remove grey periods used as thousands separators
    let $res = $(resourcesContainer).clone().remove('.grey'); 

    let resAmount = function(resIconCssClass) {
        // note: sometimes, if the res amount is 0, the game excludes it (and its icon) instead of showing 0
        let icon = $res.find('span.' + resIconCssClass).get(0);
        return icon ? parseInt($(icon.nextSibling).text()) : 0;
    }

    return {
        timber: resAmount('wood'),
        clay: resAmount('stone'),
        iron: resAmount('iron')
    };
};

twcheese.scrapePageNumber = function() {
    let currentPage = $('#paged_view_content').children('table:eq(0)').find('strong').html();
    if (currentPage && !currentPage.includes('all')) {
        return parseInt(currentPage.match(/\d+/)[0]);
    }
    return null;
};

/*==== widgets ====*/

twcheese.popupShowHaulsPrompt = function () {
    let popupHtml = `
        <div id="twcheese_showHaulsPrompt" class="twcheese-popup" style="width: 500px;">
            <div style="height: 100%; width: 100%; background: url('${twcheese.images.popupBackground}')">
                <div style="background: no-repeat url('${twcheese.images.servant}');">
                    <h3 style="margin: 0 3px 5px 120px;">My liege,</h3>
                    <div id="twcheese_servant_text" style="margin-left: 120px; height: 50px; margin-top: 30px;">
                        Dost thou wish hauls to be included on thine screen?
                    </div>
                    <div class="quest-goal">
                        <table width="100%">
                            <tbody>
                                <tr>
                                    <td style="width: 120px; height: 80px;"></td>
                                    <td id="twcheese_servant_info" style="padding-right: 70px;">
                                        <h5>Load haul information?</h5>
                                        <p>This could take a while if you have a lot of commands.</p>
                                        <div class="confirmation-buttons">
                                            <button id="twcheese_hauls_prompt_confirm" class="btn btn-confirm-yes">Yes</button>
                                            <button id="twcheese_hauls_prompt_cancel" class="btn btn-default">Cancel</button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;

    $('body').append(popupHtml);
    twcheese.fadeGameContent();

    $('#twcheese_hauls_prompt_confirm').on('click', async function(e) {
        e.preventDefault();
        document.getElementById('twcheese_servant_text').innerHTML = 'May the cheese be with you.';
        document.getElementById('twcheese_servant_info').innerHTML = 'loading... <img src="' + twcheese.images.loadingSpinner + '"></img>';

        await twcheese.enhanceScreenWithHaulInfo();

        $('#twcheese_showHaulsPrompt').remove();
        twcheese.unfadeGameContent();
    });

    $('#twcheese_hauls_prompt_cancel').on('click', function(e) {
        e.preventDefault();
        $('#twcheese_showHaulsPrompt').remove();
        twcheese.unfadeGameContent();
    });
};

/**
 *	creates a widget with statistics about the returning hauls
 *	@param {Command[]} commands
 *  @param {boolean} collapsed
 */
twcheese.createPillagingStatsWidget = function(commands, collapsed) {

    function buildDayHint(date) {
        if (date.isTodayOnServer()) {
            return '';
        }
        else if (date.isTomorrowOnServer()) {
            return ' (tomorrow)';
        }
        return ' (' + date.toLocaleDateString('en-US', {month: 'short', day: '2-digit'}) + ')';
    }
    
    let summationFromOptions = [];
    let summationToOptions = [];
    let hourlyBreakdowns = [];

    let latestCommandArrival = commands[commands.length - 1].arrival;
    let startOfHour = twcheese.Timing.newServerDate().startOfHour();

    while (startOfHour < latestCommandArrival) {
        let endOfHour = startOfHour.endOfHour();
        let hourOfDay = startOfHour.getServerHours();
        let dayHint = buildDayHint(startOfHour);

        summationFromOptions.push(`<option value=${startOfHour.getTime()}>${hourOfDay}:00 ${dayHint}</option>`);
        summationToOptions.push(`<option value="${endOfHour.getTime()}">${hourOfDay}:59 ${dayHint}</option>`);

        let result = twcheese.Command.sumPropsFromTimeframe(commands, startOfHour, endOfHour);
        hourlyBreakdowns.push(`
            <tr>
                <td>${hourOfDay}:00 - ${hourOfDay}:59 ${dayHint}</td>
                <td>${result.timber}</td>
                <td>${result.clay}</td>
                <td>${result.iron}</td>
                <td>${result.sumLoot()}/${result.haulCapacity}</td>
                <td>${result.calcHaulPercent()}%</td>
            </tr>
        `);

        startOfHour = startOfHour.addHours(1);
    }

    let pageNumber = twcheese.scrapePageNumber();
    let pageInfo = pageNumber ? `from Page ${pageNumber}` : '';

    let toggleIconSrc = collapsed ? twcheese.images.plus : twcheese.images.minus;
    let contentDisplay = collapsed ? 'none' : 'block';

    let html = `
        <div id="twcheese_pillaging_stats" class="vis widget">
            <h4>
                Pillaging Statistics
                <img id="twcheese_pillaging_stats_toggle" src="${toggleIconSrc}" style="float:right; cursor: pointer;">
                <span style="font-size: 8px; font-style: normal; font-weight: normal; margin-right: 25px; float: right;">
                    created by <a href="http://forum.tribalwars.net/member.php?u=28484">cheesasaurus</a>
                </span>
            </h4>
            <div id="twcheese_pillaging_stats_content" style="display: ${contentDisplay};">
                <!-- summation -->
                <div>
                    <div style="text-align: center; width: 100%; margin-top: 5px; margin-bottom: 5px;">
                        From <select id="twcheese_pillaging_stats_from">${summationFromOptions.join('')}</select>
                        to <select id="twcheese_pillaging_stats_to">${summationToOptions.join('')}</select>
                    </div>
                    <div id="twcheese_pillaging_results" style="text-align: center;">
                        Results displayed here...
                    </div>
                    <br/>
                </div>
                
                <!-- hourly breakdown -->
                <table class="twcheese-pillaging-stats-hourly-breakdown" width="100%">
                    <tbody>
                        <tr><td colspan="6" style="text-align: center; font-size: 16px;">Incoming Resources ${pageInfo}</td></tr>
                        <tr>
                            <th>Arrival</th>
                            <th><img src="${twcheese.images.timber}"></img></th>
                            <th><img src="${twcheese.images.clay}"></img></th>
                            <th><img src="${twcheese.images.iron}"></img></th>
                            <th colspan="2">Performance</th>
                        </tr>
                        ${hourlyBreakdowns.join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    $('.modemenu:eq(1)').after(html);

    twcheese.style.initCss(`
        .twcheese-pillaging-stats-hourly-breakdown tr:nth-child(even) td {
            background: #FFE0A2;
        }
    `);

    /**
     *	changes the results displayed in the summation section of the pillaging stats widget
     */
    let showResults = function () {
        var startTime = twcheese.Timing.newServerDate(Number(document.getElementById('twcheese_pillaging_stats_from').value));
        var endTime = twcheese.Timing.newServerDate(Number(document.getElementById('twcheese_pillaging_stats_to').value));
        if (startTime > endTime) {
            tmpTime = startTime;
            startTime = endTime;
            endTime = tmpTime;
        }
        var results = twcheese.Command.sumPropsFromTimeframe(commands, startTime, endTime);

        $('#twcheese_pillaging_results').html(`
            <img src="${twcheese.images.timber}"> ${results.timber}
            <img src="${twcheese.images.clay}"> ${results.clay}
            <img src="${twcheese.images.iron}"> ${results.iron}
            &nbsp;&nbsp;| ${results.sumLoot()}/${results.haulCapacity} (${results.calcHaulPercent()}%)
        `);
    };

    let toggleCollapse = function() {
        let icon = document.getElementById('twcheese_pillaging_stats_toggle');
        let content = $('#twcheese_pillaging_stats_content');

        content.toggle({
            duration: 200,
            start: function() {
                let willCollapse = icon.src.includes(twcheese.images.minus);
                icon.src = willCollapse ? twcheese.images.plus : twcheese.images.minus;
                twcheese.userConfig.set('commandHauls.collapseStats', willCollapse);
            }
        });
    }

    /*==== initialize interactive components ====*/
    $('#twcheese_pillaging_stats_toggle').on('click', function(e) {
        e.preventDefault();
        toggleCollapse();
    });
    document.getElementById('twcheese_pillaging_stats_from').onchange = showResults;
    document.getElementById('twcheese_pillaging_stats_to').onchange = showResults;
    document.getElementById('twcheese_pillaging_stats_to').childNodes[document.getElementById('twcheese_pillaging_stats_to').childNodes.length - 1].selected = "selected";
    showResults();

};

/*==== enhancement functions ====*/

twcheese.appendHaulColsToCommandsTable = async function () {
    let commandsTable = document.getElementById('commands_table');

    $(commandsTable.rows[0]).append(`
        <th><img src="${twcheese.images.timber}" title="Wood" alt="Timber"></th>
        <th><img src="${twcheese.images.clay}" title="Clay" alt="Clay"></th>
        <th><img src="${twcheese.images.iron}" title="Iron" alt="Iron"></th>
        <th>Performance</th>
    `);

    /*==== append resources hauled to each row in the commands table ====*/
    for (let row of commandsTable.rows) {
        let firstCell = row.cells[0];
        if (firstCell.tagName.toLowerCase() === 'th') {
            // no command here! this is a header row. e.g. the "select all" bar
            row.cells[row.cells.length - 1].colSpan += 4;
            continue;
        }

        var commandUrl = firstCell.getElementsByTagName('a')[0].href;
        var command = twcheese.scrapeCommand(await twcheese.requestDocumentBody(commandUrl));

        /*==== add command to list if it is returning ====*/
        var command_type = $(firstCell).find('.own_command').data('command-type');
        if (command_type === 'return') {            
            twcheese.commands.commandsList.push(command);
        }

        $(row).append(`
            <td>${command.timber}</td>
            <td>${command.clay}</td>
            <td>${command.iron}</td>
            <td>${command.sumLoot()}/${command.haulCapacity} (${command.calcHaulPercent()}%)</td>
        `);
    }
};

twcheese.fadeGameContent = function () {
    $('body').append('<div id="fader" class="fader">');
};
twcheese.unfadeGameContent = function() {
    $('#fader').remove();
}

/*==== styles ====*/
if (!twcheese.style) {
    twcheese.style = {
        cssInitd: [],

        initCss(css) {
            if (this.cssInitd.includes(css)) {
                return;
            }
            $(`<style>${css}</style>`).appendTo('head');
            this.cssInitd.push(css);
        }
    };
}

twcheese.style.initCss(`
    .twcheese-popup {
        z-index: 13000;
        display: block;
        position: fixed;
        top: 60px;
        border: 19px solid #804000;
        border-image: url(${twcheese.images.popupBorder}) 19 19 19 19 repeat;
        left: 50%;
        -webkit-transform: translateX(-50%);
        transform: translateX(-50%);
    }
`);

twcheese.enhanceScreenWithHaulInfo = async function () {
    await twcheese.appendHaulColsToCommandsTable(document);

    let collapseStats = twcheese.userConfig.get('commandHauls.collapseStats', false);
    twcheese.createPillagingStatsWidget(twcheese.commands.commandsList, collapseStats);

    twcheese.haulsIncluded = true;
};

/*==== main ====*/

if (!twcheese.commands)
    twcheese.commands = {};

twcheese.commands.commandsList = new Array();

if (!twcheese.haulsIncluded) {
    if (game_data.screen == 'overview_villages' && game_data.mode == 'commands') {
        twcheese.popupShowHaulsPrompt();
    }
    else
        alert('To use this, you must be on the commands overview. It\'s recommended to use the \'return\' filter, since outgoing troops don\'t carry resources :)');
}
else {
    UI.InfoMessage('This is already active.', 3000, 'error');
}
