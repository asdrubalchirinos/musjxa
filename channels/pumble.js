function post(message, channel) {
    const body = JSON.stringify({ text: message })
    return curlPost(channel.webhookUrl, ["Content-Type: application/json"], body)
}
