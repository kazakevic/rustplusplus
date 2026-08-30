/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

const Config = require('../../config');

/**
 * Describes the configured discord token without revealing it, to make a failed login debuggable.
 * Can also be run directly on a machine where the bot fails to start:
 *
 *     node src/util/tokenDiagnostics.js
 */
function getDiscordTokenDiagnostics() {
    const token = Config.discord.token;
    const source = process.env.RPP_DISCORD_TOKEN ?
        'environment variable RPP_DISCORD_TOKEN' : 'config/index.js (RPP_DISCORD_TOKEN not set)';

    if (typeof token !== 'string') {
        return `source: ${source}, token is of type '${typeof token}' (expected a string)`;
    }

    if (token === '') {
        return `source: ${source}, token is empty`;
    }

    const trimmed = token.trim();
    const segments = trimmed.split('.');
    const details = [
        `source: ${source}`,
        `length: ${token.length} (usual bot token length is 59-75)`,
        `starts with: '${trimmed.slice(0, 5)}...'`,
        `ends with: '...${trimmed.slice(-5)}'`,
        `segments: ${segments.length} (a bot token has 3, separated by '.')`
    ];

    /* The first token segment is the base64 encoded application/client id. */
    let tokenClientId = null;
    try {
        const decoded = Buffer.from(segments[0], 'base64').toString('utf8');
        if (/^\d{17,20}$/.test(decoded)) {
            tokenClientId = decoded;
        }
    }
    catch (error) {
        /* Ignore, handled by the tokenClientId === null case below. */
    }

    if (tokenClientId === null) {
        details.push(`clientId in token: could not be decoded from the first segment ` +
            `(the token is malformed or truncated)`);
    }
    else {
        details.push(`clientId in token: ${tokenClientId}`);

        if (Config.discord.clientId === '') {
            details.push(`WARNING: RPP_DISCORD_CLIENT_ID is not set`);
        }
        else if (Config.discord.clientId !== tokenClientId) {
            details.push(`WARNING: token belongs to another application than the configured ` +
                `clientId ${Config.discord.clientId}`);
        }
    }

    if (token !== trimmed) {
        details.push(`WARNING: token has leading/trailing whitespace`);
    }

    if (/^["']|["']$/.test(trimmed)) {
        details.push(`WARNING: token is wrapped in quotes`);
    }

    if (/^bot\s/i.test(trimmed)) {
        details.push(`WARNING: token starts with the 'Bot ' prefix, it should not be included`);
    }

    if (/\s/.test(trimmed)) {
        details.push(`WARNING: token contains whitespace`);
    }

    if (trimmed.startsWith('MFA.') || trimmed.startsWith('mfa.')) {
        details.push(`WARNING: this looks like a user token, not a bot token`);
    }

    return details.join(', ');
}

/**
 * Asks discord who the token belongs to. Only used when running this file directly, the bot itself
 * should not do an extra request on startup.
 */
async function verifyDiscordToken() {
    const Axios = require('axios');

    try {
        const response = await Axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bot ${Config.discord.token.trim()}` },
            validateStatus: () => true
        });

        if (response.status === 200) {
            return `discord accepted the token, it belongs to ` +
                `${response.data.username} (${response.data.id})`;
        }

        return `discord rejected the token, HTTP ${response.status}: ${JSON.stringify(response.data)}`;
    }
    catch (error) {
        return `could not reach discord: ${error.message} (network/DNS/proxy issue, not the token)`;
    }
}

if (require.main === module) {
    (async () => {
        console.log(`Token diagnostics: ${getDiscordTokenDiagnostics()}`);
        console.log(`Token check: ${await verifyDiscordToken()}`);
    })();
}

module.exports = { getDiscordTokenDiagnostics, verifyDiscordToken };
