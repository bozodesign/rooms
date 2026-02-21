// LINE Messaging API utilities

const LINE_API_URL = 'https://api.line.me/v2/bot/message/push'
const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply'

export interface FlexMessage {
    type: 'flex'
    altText: string
    contents: FlexContainer
}

export interface FlexContainer {
    type: 'bubble' | 'carousel'
    [key: string]: unknown
}

export async function sendLineMessage(userId: string, messages: unknown[]) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!channelAccessToken) {
        throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
    }

    const response = await fetch(LINE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
            to: userId,
            messages: messages,
        }),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('LINE API Error:', errorData)
        throw new Error(`Failed to send LINE message: ${response.status}`)
    }

    return response
}

// Reply to a LINE message using replyToken
export async function replyLineMessage(
    replyToken: string,
    messages: unknown[],
) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (!channelAccessToken) {
        throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
    }

    const response = await fetch(LINE_REPLY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
            replyToken,
            messages,
        }),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('LINE Reply API Error:', errorData)
        throw new Error(`Failed to reply LINE message: ${response.status}`)
    }

    return response
}

// Generate PromptPay payload for QR code
// PromptPay QR format follows EMVCo standard
export function generatePromptPayPayload(
    phoneOrId: string,
    amount?: number,
): string {
    // Clean the phone number (remove dashes, spaces)
    const cleanId = phoneOrId.replace(/[-\s]/g, '')

    // Determine if it's a phone number or national ID
    const isPhone = cleanId.length === 10
    const accountType = isPhone ? '01' : '02' // 01 = phone, 02 = national ID

    // Format phone number for PromptPay (add country code 66)
    let formattedId = cleanId
    if (isPhone && cleanId.startsWith('0')) {
        formattedId = '66' + cleanId.substring(1)
    }

    // Build EMVCo QR payload
    const payloadParts: string[] = []

    // Payload Format Indicator
    payloadParts.push('000201')

    // Point of Initiation (12 = dynamic, 11 = static)
    payloadParts.push(amount ? '010212' : '010211')

    // Merchant Account Information for PromptPay
    const aid = 'A000000677010111' // PromptPay AID
    const aidTag = `00${aid.length.toString().padStart(2, '0')}${aid}`
    const idTag = `${accountType}${formattedId.length.toString().padStart(2, '0')}${formattedId}`
    const merchantInfo = aidTag + idTag
    payloadParts.push(
        `29${merchantInfo.length.toString().padStart(2, '0')}${merchantInfo}`,
    )

    // Country Code
    payloadParts.push('5802TH')

    // Transaction Amount (if provided)
    if (amount) {
        const amountStr = amount.toFixed(2)
        payloadParts.push(
            `54${amountStr.length.toString().padStart(2, '0')}${amountStr}`,
        )
    }

    // Transaction Currency (THB = 764)
    payloadParts.push('5303764')

    // CRC placeholder
    const payloadWithoutCRC = payloadParts.join('') + '6304'

    // Calculate CRC16
    const crc = calculateCRC16(payloadWithoutCRC)

    return payloadWithoutCRC + crc
}

// CRC-16/CCITT-FALSE calculation
function calculateCRC16(str: string): string {
    let crc = 0xffff

    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021
            } else {
                crc = crc << 1
            }
        }
        crc &= 0xffff
    }

    return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Create invoice Flex Message for LINE
export function createInvoiceFlexMessage(
    invoice: {
        roomNumber: string
        tenantName: string
        month: number
        year: number
        rentAmount: number
        waterAmount: number
        waterUnits: number
        electricityAmount: number
        electricityUnits: number
        otherCharges?: { description: string; amount: number }[]
        totalAmount: number
        dueDate: Date
    },
    promptpayNumber?: string,
    promptpayName?: string,
): FlexMessage {
    const monthNames = [
        'ม.ค.',
        'ก.พ.',
        'มี.ค.',
        'เม.ย.',
        'พ.ค.',
        'มิ.ย.',
        'ก.ค.',
        'ส.ค.',
        'ก.ย.',
        'ต.ค.',
        'พ.ย.',
        'ธ.ค.',
    ]
    const monthName = monthNames[invoice.month - 1]
    const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })

    const formatCurrency = (amount: number) =>
        amount.toLocaleString('th-TH', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        })

    // Build charge items
    const chargeItems: unknown[] = [
        {
            type: 'box',
            layout: 'horizontal',
            contents: [
                {
                    type: 'text',
                    text: 'ค่าเช่า',
                    size: 'sm',
                    color: '#555555',
                    flex: 0,
                },
                {
                    type: 'text',
                    text: `฿${formatCurrency(invoice.rentAmount)}`,
                    size: 'sm',
                    color: '#111111',
                    align: 'end',
                },
            ],
        },
    ]

    if (invoice.waterAmount > 0) {
        chargeItems.push({
            type: 'box',
            layout: 'horizontal',
            contents: [
                {
                    type: 'text',
                    text: `ค่าน้ำ (${invoice.waterUnits} หน่วย)`,
                    size: 'sm',
                    color: '#555555',
                    flex: 0,
                },
                {
                    type: 'text',
                    text: `฿${formatCurrency(invoice.waterAmount)}`,
                    size: 'sm',
                    color: '#111111',
                    align: 'end',
                },
            ],
        })
    }

    if (invoice.electricityAmount > 0) {
        chargeItems.push({
            type: 'box',
            layout: 'horizontal',
            contents: [
                {
                    type: 'text',
                    text: `ค่าไฟ (${invoice.electricityUnits} หน่วย)`,
                    size: 'sm',
                    color: '#555555',
                    flex: 0,
                },
                {
                    type: 'text',
                    text: `฿${formatCurrency(invoice.electricityAmount)}`,
                    size: 'sm',
                    color: '#111111',
                    align: 'end',
                },
            ],
        })
    }

    // Add other charges
    if (invoice.otherCharges && invoice.otherCharges.length > 0) {
        for (const charge of invoice.otherCharges) {
            chargeItems.push({
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'text',
                        text: charge.description,
                        size: 'sm',
                        color: '#555555',
                        flex: 0,
                    },
                    {
                        type: 'text',
                        text: `฿${formatCurrency(charge.amount)}`,
                        size: 'sm',
                        color: '#111111',
                        align: 'end',
                    },
                ],
            })
        }
    }

    // Build footer with PromptPay QR if available
    const footerContents: unknown[] = []

    if (promptpayNumber) {
        const qrPayload = generatePromptPayPayload(
            promptpayNumber,
            invoice.totalAmount,
        )
        const qrUrl = `https://promptpay.io/${promptpayNumber}/${invoice.totalAmount}.png`

        footerContents.push({
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: 'สแกนเพื่อชำระเงิน',
                    size: 'sm',
                    color: '#1DB446',
                    weight: 'bold',
                    align: 'center',
                },
                {
                    type: 'image',
                    url: qrUrl,
                    size: 'lg',
                    aspectMode: 'fit',
                    aspectRatio: '1:1',
                },
                {
                    type: 'text',
                    text: promptpayName || 'PromptPay',
                    size: 'xs',
                    color: '#aaaaaa',
                    align: 'center',
                    margin: 'sm',
                },
                {
                    type: 'text',
                    text: promptpayNumber.replace(
                        /(\d{3})(\d{3})(\d{4})/,
                        '$1-$2-$3',
                    ),
                    size: 'xs',
                    color: '#aaaaaa',
                    align: 'center',
                },
            ],
            margin: 'lg',
            paddingTop: 'md',
            borderWidth: 'normal',
            borderColor: '#eeeeee',
            cornerRadius: 'md',
            paddingAll: 'md',
        })
    }

    const bubble = {
        type: 'bubble',
        size: 'mega',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: 'ใบแจ้งค่าเช่า',
                            size: 'lg',
                            weight: 'bold',
                            color: '#ffffff',
                        },
                        {
                            type: 'text',
                            text: `${monthName} ${invoice.year + 543}`,
                            size: 'sm',
                            color: '#ffffff',
                            align: 'end',
                        },
                    ],
                },
            ],
            paddingAll: 'lg',
            backgroundColor: '#1DB446',
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: `ห้อง ${invoice.roomNumber}`,
                            size: 'xl',
                            weight: 'bold',
                            color: '#222222',
                        },
                    ],
                },
                {
                    type: 'text',
                    text: invoice.tenantName,
                    size: 'sm',
                    color: '#999999',
                    margin: 'sm',
                },
                {
                    type: 'separator',
                    margin: 'lg',
                },
                {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    spacing: 'sm',
                    contents: chargeItems,
                },
                {
                    type: 'separator',
                    margin: 'lg',
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'lg',
                    contents: [
                        {
                            type: 'text',
                            text: 'รวมทั้งหมด',
                            size: 'md',
                            weight: 'bold',
                            color: '#222222',
                        },
                        {
                            type: 'text',
                            text: `฿${formatCurrency(invoice.totalAmount)}`,
                            size: 'lg',
                            weight: 'bold',
                            color: '#1DB446',
                            align: 'end',
                        },
                    ],
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: 'กำหนดชำระ',
                            size: 'xs',
                            color: '#aaaaaa',
                        },
                        {
                            type: 'text',
                            text: dueDateStr,
                            size: 'xs',
                            color: '#aaaaaa',
                            align: 'end',
                        },
                    ],
                },
                ...footerContents,
                {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    contents: [
                        {
                            type: 'text',
                            text: 'ชำระแล้วโปรดแจ้งสลิปที่แชตนี้',
                            size: 'sm',
                            color: '#1DB446',
                            align: 'center',
                            weight: 'bold',
                        },
                    ],
                    paddingAll: 'md',
                    backgroundColor: '#E8F5E9',
                    cornerRadius: 'md',
                },
            ],
            paddingAll: 'lg',
        },
    }

    return {
        type: 'flex',
        altText: `ใบแจ้งค่าเช่าห้อง ${invoice.roomNumber} เดือน ${monthName} ${invoice.year + 543} - ฿${formatCurrency(invoice.totalAmount)}`,
        contents: bubble as FlexContainer,
    }
}

// Create payment receipt Flex Message for LINE
export function createReceiptFlexMessage(invoice: {
    roomNumber: string
    tenantName: string
    month: number
    year: number
    rentAmount: number
    waterAmount: number
    waterUnits: number
    electricityAmount: number
    electricityUnits: number
    otherCharges?: { description: string; amount: number }[]
    totalAmount: number
    paidAt: Date
}): FlexMessage {
    const monthNames = [
        'ม.ค.',
        'ก.พ.',
        'มี.ค.',
        'เม.ย.',
        'พ.ค.',
        'มิ.ย.',
        'ก.ค.',
        'ส.ค.',
        'ก.ย.',
        'ต.ค.',
        'พ.ย.',
        'ธ.ค.',
    ]
    const monthName = monthNames[invoice.month - 1]
    const paidAtStr = new Date(invoice.paidAt).toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

    const formatCurrency = (amount: number) =>
        amount.toLocaleString('th-TH', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        })

    // Build charge items
    const chargeItems: unknown[] = [
        {
            type: 'box',
            layout: 'horizontal',
            contents: [
                {
                    type: 'text',
                    text: 'ค่าเช่า',
                    size: 'sm',
                    color: '#555555',
                    flex: 0,
                },
                {
                    type: 'text',
                    text: `฿${formatCurrency(invoice.rentAmount)}`,
                    size: 'sm',
                    color: '#111111',
                    align: 'end',
                },
            ],
        },
    ]

    if (invoice.waterAmount > 0) {
        chargeItems.push({
            type: 'box',
            layout: 'horizontal',
            contents: [
                {
                    type: 'text',
                    text: `ค่าน้ำ (${invoice.waterUnits} หน่วย)`,
                    size: 'sm',
                    color: '#555555',
                    flex: 0,
                },
                {
                    type: 'text',
                    text: `฿${formatCurrency(invoice.waterAmount)}`,
                    size: 'sm',
                    color: '#111111',
                    align: 'end',
                },
            ],
        })
    }

    if (invoice.electricityAmount > 0) {
        chargeItems.push({
            type: 'box',
            layout: 'horizontal',
            contents: [
                {
                    type: 'text',
                    text: `ค่าไฟ (${invoice.electricityUnits} หน่วย)`,
                    size: 'sm',
                    color: '#555555',
                    flex: 0,
                },
                {
                    type: 'text',
                    text: `฿${formatCurrency(invoice.electricityAmount)}`,
                    size: 'sm',
                    color: '#111111',
                    align: 'end',
                },
            ],
        })
    }

    // Add other charges
    if (invoice.otherCharges && invoice.otherCharges.length > 0) {
        for (const charge of invoice.otherCharges) {
            chargeItems.push({
                type: 'box',
                layout: 'horizontal',
                contents: [
                    {
                        type: 'text',
                        text: charge.description,
                        size: 'sm',
                        color: '#555555',
                        flex: 0,
                    },
                    {
                        type: 'text',
                        text: `฿${formatCurrency(charge.amount)}`,
                        size: 'sm',
                        color: '#111111',
                        align: 'end',
                    },
                ],
            })
        }
    }

    const bubble = {
        type: 'bubble',
        size: 'mega',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: 'ใบเสร็จรับเงิน',
                            size: 'lg',
                            weight: 'bold',
                            color: '#ffffff',
                        },
                        {
                            type: 'text',
                            text: `${monthName} ${invoice.year + 543}`,
                            size: 'sm',
                            color: '#ffffff',
                            align: 'end',
                        },
                    ],
                },
            ],
            paddingAll: 'lg',
            backgroundColor: '#27ACB2',
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'box',
                    layout: 'horizontal',
                    contents: [
                        {
                            type: 'text',
                            text: `ห้อง ${invoice.roomNumber}`,
                            size: 'xl',
                            weight: 'bold',
                            color: '#222222',
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            contents: [
                                {
                                    type: 'text',
                                    text: 'ชำระแล้ว',
                                    size: 'xs',
                                    color: '#ffffff',
                                    align: 'center',
                                },
                            ],
                            backgroundColor: '#1DB446',
                            paddingAll: 'xs',
                            cornerRadius: 'sm',
                        },
                    ],
                },
                {
                    type: 'text',
                    text: invoice.tenantName,
                    size: 'sm',
                    color: '#999999',
                    margin: 'sm',
                },
                {
                    type: 'separator',
                    margin: 'lg',
                },
                {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    spacing: 'sm',
                    contents: chargeItems,
                },
                {
                    type: 'separator',
                    margin: 'lg',
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'lg',
                    contents: [
                        {
                            type: 'text',
                            text: 'ยอดชำระ',
                            size: 'md',
                            weight: 'bold',
                            color: '#222222',
                        },
                        {
                            type: 'text',
                            text: `฿${formatCurrency(invoice.totalAmount)}`,
                            size: 'lg',
                            weight: 'bold',
                            color: '#27ACB2',
                            align: 'end',
                        },
                    ],
                },
                {
                    type: 'box',
                    layout: 'horizontal',
                    margin: 'md',
                    contents: [
                        {
                            type: 'text',
                            text: 'วันที่ชำระ',
                            size: 'xs',
                            color: '#aaaaaa',
                        },
                        {
                            type: 'text',
                            text: paidAtStr,
                            size: 'xs',
                            color: '#aaaaaa',
                            align: 'end',
                        },
                    ],
                },
                {
                    type: 'box',
                    layout: 'vertical',
                    margin: 'lg',
                    contents: [
                        {
                            type: 'text',
                            text: 'ขอบคุณที่ชำระเงินตรงเวลา',
                            size: 'sm',
                            color: '#1DB446',
                            align: 'center',
                            weight: 'bold',
                        },
                    ],
                    paddingAll: 'md',
                    backgroundColor: '#E8F5E9',
                    cornerRadius: 'md',
                },
            ],
            paddingAll: 'lg',
        },
    }

    return {
        type: 'flex',
        altText: `ใบเสร็จรับเงินห้อง ${invoice.roomNumber} เดือน ${monthName} ${invoice.year + 543} - ฿${formatCurrency(invoice.totalAmount)}`,
        contents: bubble as FlexContainer,
    }
}

// Create error message for slip verification failure
export function createSlipErrorMessage(errorMessage: string): unknown {
    return {
        type: 'text',
        text: `❌ ${errorMessage}\n\nกรุณาตรวจสอบและส่งสลิปใหม่อีกครั้ง`,
    }
}

// Create admin portal link Flex Message
export function createAdminLinkFlexMessage(liffId: string): FlexMessage {
    const liffUrl = `https://liff.line.me/${liffId}`

    const bubble = {
        type: 'bubble',
        size: 'kilo',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: 'ระบบจัดการหอพัก',
                    size: 'lg',
                    weight: 'bold',
                    color: '#ffffff',
                    align: 'center',
                },
            ],
            paddingAll: 'lg',
            backgroundColor: '#1a1a1a',
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [],
            paddingAll: 'lg',
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'button',
                    action: {
                        type: 'uri',
                        label: 'เข้าสู่ระบบผู้ดูแล',
                        uri: liffUrl,
                    },
                    style: 'primary',
                    color: '#2754F5',
                },
            ],
            paddingAll: 'md',
        },
    }

    return {
        type: 'flex',
        altText: 'ลิงก์เข้าสู่ระบบผู้ดูแล',
        contents: bubble as FlexContainer,
    }
}
