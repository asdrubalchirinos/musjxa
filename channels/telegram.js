function post(message, channel) {
    const body = JSON.stringify({ chat_id: channel.chatId, text: message })
    const url = "https://api.telegram.org/bot" + channel.botToken + "/sendMessage"
    return curlPost(url, ["Content-Type: application/json"], body)
}
