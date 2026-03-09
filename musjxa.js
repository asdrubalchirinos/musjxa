ObjC.import('Foundation')

const app = Application.currentApplication()
app.includeStandardAdditions = true

let lastTrack = ""

// --- Config ---

function loadConfig() {
    const dir = $.NSFileManager.defaultManager.currentDirectoryPath.js
    const configPath = dir + "/config.json"
    const examplePath = dir + "/config.example.json"

    let path = configPath
    const fm = $.NSFileManager.defaultManager
    if (!fm.fileExistsAtPath(configPath)) {
        if (!fm.fileExistsAtPath(examplePath)) {
            throw new Error("No config.json or config.example.json found in " + dir)
        }
        console.log("config.json not found — using config.example.json")
        path = examplePath
    }

    const nsStr = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null)
    return JSON.parse(nsStr.js)
}

// --- Template ---

function renderTemplate(template, track, artist) {
    return template
        .replace(/\{\{track\}\}/g, track)
        .replace(/\{\{artist\}\}/g, artist)
}

// --- Notification ---

const HAS_TERMINAL_NOTIFIER = (() => {
    try {
        app.doShellScript("which terminal-notifier")
        return true
    } catch (e) {
        return false
    }
})()

function notify(title, message) {
    if (HAS_TERMINAL_NOTIFIER) {
        const dir = $.NSFileManager.defaultManager.currentDirectoryPath.js
        const iconPath = dir + "/icon.png"
        const hasIcon = $.NSFileManager.defaultManager.fileExistsAtPath(iconPath)
        let cmd = `terminal-notifier -title '${shellEscape(title)}' -message '${shellEscape(message)}' -group musjxa`
        if (hasIcon) cmd += ` -appIcon '${shellEscape(iconPath)}'`
        try { app.doShellScript(cmd) } catch (e) {}
    } else {
        app.displayNotification(message, { withTitle: title, soundName: "" })
    }
}

// --- Shell helper ---

function shellEscape(str) {
    return str.replace(/'/g, "'\\''")
}

function curlPost(url, headers, jsonBody) {
    let cmd = "/usr/bin/curl -s -X POST"
    for (const h of headers) {
        cmd += ` -H '${shellEscape(h)}'`
    }
    cmd += ` -d '${shellEscape(jsonBody)}'`
    cmd += ` '${shellEscape(url)}'`
    return app.doShellScript(cmd)
}

// --- Plugin loader ---

function loadChannels() {
    const dir = $.NSFileManager.defaultManager.currentDirectoryPath.js + "/channels"
    const fm = $.NSFileManager.defaultManager
    const handlers = {}

    if (!fm.fileExistsAtPath(dir)) {
        console.log("Warning: channels/ directory not found")
        return handlers
    }

    const files = fm.contentsOfDirectoryAtPathError(dir, null)
    const count = files.count

    for (let i = 0; i < count; i++) {
        const filename = files.objectAtIndex(i).js
        if (!filename.endsWith(".js")) continue

        const type = filename.replace(/\.js$/, "")
        const filePath = dir + "/" + filename
        const source = $.NSString.stringWithContentsOfFileEncodingError(filePath, $.NSUTF8StringEncoding, null).js

        try {
            const loader = new Function(source + "\nreturn post;")
            handlers[type] = loader()
            console.log("  loaded: " + type)
        } catch (e) {
            console.log("  FAILED: " + type + " — " + e.message)
        }
    }

    return handlers
}

console.log("Loading channel plugins...")
const CHANNEL_HANDLERS = loadChannels()

// --- Dispatch ---

function dispatch(config, track, artist) {
    for (const channel of config.channels) {
        if (!channel.enabled) continue

        const handler = CHANNEL_HANDLERS[channel.type]
        if (!handler) {
            console.log("Unknown channel type: " + channel.type + " — skipping")
            continue
        }

        const message = renderTemplate(channel.template, track, artist)
        try {
            handler(message, channel)
            console.log(`[${channel.type}] ${track} — ${artist}`)
        } catch (e) {
            console.log(`[${channel.type}] ERROR: ${e.message}`)
        }
    }
}

// --- PID file ---

function writePidFile() {
    const dir = $.NSFileManager.defaultManager.currentDirectoryPath.js
    const pid = $.NSProcessInfo.processInfo.processIdentifier
    $(String(pid)).writeToFileAtomicallyEncodingError(dir + "/musjxa.pid", true, $.NSUTF8StringEncoding, null)
}

function removePidFile() {
    const dir = $.NSFileManager.defaultManager.currentDirectoryPath.js
    $.NSFileManager.defaultManager.removeItemAtPathError(dir + "/musjxa.pid", null)
}

// --- Main loop ---

const config = loadConfig()
const pollInterval = config.pollInterval || 5

writePidFile()

const enabledChannels = config.channels.filter(c => c.enabled).map(c => c.type)
console.log("Musjxa started (polling every " + pollInterval + "s)")
console.log("Enabled channels: " + (enabledChannels.length ? enabledChannels.join(", ") : "none"))
console.log("Play a song in Apple Music to see output.")
console.log("Press Ctrl+C to stop.\n")

notify("Musjxa started", "Polling every " + pollInterval + "s — channels: " + (enabledChannels.length ? enabledChannels.join(", ") : "none"))

function checkNowPlaying() {
    try {
        const music = Application("Music")

        if (!music.running() || music.playerState() !== "playing") return

        const currentTrack = music.currentTrack()
        const artist = currentTrack.artist()
        const track = currentTrack.name()

        if (!artist || !track) return

        const current = `${artist}::${track}`
        if (current === lastTrack) return
        lastTrack = current

        dispatch(config, track, artist)
    } catch (e) {
        // Music app not running or no track playing
    }
}

while (true) {
    checkNowPlaying()
    $.NSThread.sleepForTimeInterval(pollInterval)
}
