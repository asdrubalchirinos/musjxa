function post(message, channel) {
    const body = JSON.stringify({ text: message })
    return curlPost(
        "https://api.twitter.com/2/tweets",
        ["Content-Type: application/json", "Authorization: Bearer " + channel.bearerToken],
        body
    )
}
