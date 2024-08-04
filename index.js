const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const client = new Client();

let userState = {};

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    const contact = await msg.getContact();
    const userId = contact.id._serialized;

    if (!userState[userId]) {
        userState[userId] = { step: 'start' };
    }

    switch (userState[userId].step) {
        case 'start':
            await chat.sendMessage('Welcome to PrintPE! Please send the PDF you want to print.');
            userState[userId].step = 'waitingForPDF';
            break;

        case 'waitingForPDF':
            if (msg.hasMedia && msg.type === 'document') {
                const media = await msg.downloadMedia();
                fs.writeFileSync(`${userId}_print.pdf`, media.data, 'base64');
                await chat.sendMessage('PDF received. How many copies do you want?');
                userState[userId].step = 'askingCopies';
            } else {
                await chat.sendMessage('Please send a PDF file.');
            }
            break;

        case 'askingCopies':
            if (!isNaN(msg.body)) {
                userState[userId].copies = parseInt(msg.body);
                await chat.sendMessage('Do you want black and white or color print? (Reply "BW" or "Color")');
                userState[userId].step = 'askingColor';
            } else {
                await chat.sendMessage('Please enter a valid number for copies.');
            }
            break;

        case 'askingColor':
            if (msg.body.toLowerCase() === 'bw' || msg.body.toLowerCase() === 'color') {
                userState[userId].color = msg.body.toLowerCase();
                await chat.sendMessage('Do you want double-sided or single-sided print? (Reply "Double" or "Single")');
                userState[userId].step = 'askingSides';
            } else {
                await chat.sendMessage('Please reply with "BW" or "Color".');
            }
            break;

        case 'askingSides':
            if (msg.body.toLowerCase() === 'double' || msg.body.toLowerCase() === 'single') {
                userState[userId].sides = msg.body.toLowerCase();
                const cost = calculateCost(userState[userId]);
                await chat.sendMessage(`Your estimated cost is ₹${cost}. Do you want to pay online or offline? (Reply "Online" or "Offline")`);
                userState[userId].step = 'askingPayment';
            } else {
                await chat.sendMessage('Please reply with "Double" or "Single".');
            }
            break;

        case 'askingPayment':
            if (msg.body.toLowerCase() === 'online' || msg.body.toLowerCase() === 'offline') {
                userState[userId].payment = msg.body.toLowerCase();
                const otp = generateOTP();
                userState[userId].otp = otp;
                await chat.sendMessage(`Your OTP is ${otp}. Show this to the vendor for verification. Thank you for using PrintPE!`);
                userState[userId].step = 'completed';
            } else {
                await chat.sendMessage('Please reply with "Online" or "Offline".');
            }
            break;

        case 'completed':
            await chat.sendMessage('Your print job is already submitted. If you want to start a new print job, please type "Start".');
            if (msg.body.toLowerCase() === 'start') {
                userState[userId] = { step: 'start' };
            }
            break;
    }
});

client.initialize();

function calculateCost(printJob) {
    // This is a placeholder function. Implement your actual cost calculation logic here.
    let baseCost = printJob.copies * (printJob.color === 'color' ? 5 : 2);
    baseCost *= (printJob.sides === 'double' ? 1.5 : 1);
    return baseCost;
}

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
}