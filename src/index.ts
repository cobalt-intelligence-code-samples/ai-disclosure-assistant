import aws from 'aws-sdk';
import OpenAI from 'openai';
import { threadId } from 'worker_threads';

const secretsManager = new aws.SecretsManager({
    region: 'us-east-1'
});


(async () => {
    const nonProxyCredentials: any = await secretsManager.getSecretValue({ SecretId: 'nonProxyCredentials' }).promise();
    const nonProxyCredentialsJson = JSON.parse(nonProxyCredentials.SecretString);

    const openai = new OpenAI({
        apiKey: nonProxyCredentialsJson.openAIApiKey
    });

    const assistantId = 'asst_BWI8etH8mLa72LUk4E92ktoU';

    const thread = await openai.beta.threads.create({
        messages: [
            {
                role: 'user',
                content: 'Hey, tell me about the dates I need to know about in California.'
            }
        ]
    });

    let completed = false;
    let initialRun = true;

    // need to make sure we are blocking here
    while (!completed) {
        if (initialRun) {
            const response = await processInput(assistantId, thread, openai);
        }
        else {
            initialRun = false;
        }

        // accept user input via stdin
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // block with promise until readline resolves
        return new Promise((resolve, reject) => {
            readline.question('Any follow up questions? ', async (input: string) => {
                readline.close();

                
                console.log('user input', input);
                if (input.includes('all done')) {
                    completed = true;

                    return resolve(null);
                }

                await openai.beta.threads.messages.create(thread.id, {
                    role: 'user',
                    content: input
                });

                const response = await processInput(assistantId, thread, openai);

                console.log('response', response);
                resolve(null);
            });
        });
    }



})();

async function processInput(assistantId, thread, openai) {    
    let run = await openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistantId
    });

    while (run.status !== 'completed' && run.status !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        run = await openai.beta.threads.runs.retrieve(thread.id, run.id);
        console.log('run status', run.status);
    }

    if (run.status === 'failed') {
        return console.log('run', run, 'thread', thread);
    }

    const messagesList = await openai.beta.threads.messages.list(thread.id);
    console.log('finalMessage', messagesList.data[0].content);

    return messagesList.data[0].content;
}