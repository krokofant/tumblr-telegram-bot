#!/usr/bin/env node
"use strict";
const Tumblr = require("tumblrwks");
const TelegramBot = require("node-telegram-bot-api");
const jsonfile = require("jsonfile");
const request = require("request");

    // Load settings.json
var loadSettings,
    // Save settings to settings.json
    saveSettings,
    // Global settings object
    settings,
    // Tumblr agent
    tumblr,
    // Telegram agent
    bot,
    // Run bot
    run;

loadSettings = function loadSettings() {
    return jsonfile.readFileSync("./settings.json");
};

saveSettings = function saveSettings( settings ) {
    jsonfile.writeFileSync("./settings.json", settings, { spaces: 4 });
};

settings = loadSettings();

tumblr = new Tumblr(
	{ consumerKey: settings.tumblr.consumerKey },
	settings.tumblr.site
);

bot = new TelegramBot( settings.telegram.token, { polling: false });

run = function run() {
    settings = loadSettings();
    tumblr.get("/posts", { limit: settings.tumblr.limit })
    .then(function( data ) {
        var posts = data.posts,
            promises,
            matches;

        promises = posts.map(function( post ) {
            // Find image reference in body
            matches = post.body.match( /<img.*src=["'](.+)["']\/?>/ );

            // Filter old posts and posts without image
            if ( !(post.timestamp <= settings.updated) && Array.isArray( matches ) ) {
                return bot.sendDocument(
                    settings.telegram.chatId,
                    request( matches[ 1 ] ),
                    { caption: post.title + "\n" + post.post_url }
                );
            }
            return null;
        })
        .filter( post => post !== null );

        // Temporarily save the latest timestamp
        settings.updated = posts.reduce(function( prevValue, currentPost ) {
            return Math.max( prevValue, currentPost.timestamp );
        }, settings.updated );

        // Save the latest timestamp (& settings) to file
        saveSettings( settings );

        return Promise.all( promises );
    })
    .then(function( messages ) {
        if ( messages.length > 0 ) {

            console.log("Sent all " + messages.length + " posts to Telegram");
        } else {
            console.log("No new posts to send :-(");
        }
    })
    .catch( console.error );
};

setInterval( run, 10000 );
