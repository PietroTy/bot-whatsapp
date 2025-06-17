async function perguntarIA(messages) {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (!apiKey) throw new Error("TOGETHER_API_KEY not set in .env");
    const payload = {
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
    };
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };
    const response = await axios.post(
        "https://api.together.xyz/v1/chat/completions",
        payload,
        { headers }
    );
    return response.data.choices[0].message.content.trim();
}