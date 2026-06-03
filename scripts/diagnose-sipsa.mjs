import { XMLParser } from 'fast-xml-parser'

const endpoint = process.env.SIPSA_ENDPOINT ?? 'https://appweb.dane.gov.co/sipsaWS/SrvSipsaUpraBeanService'
const opName = process.env.SIPSA_OP ?? 'promediosSipsaCiudad'
const ns = 'http://servicios.sipsa.co.gov.dane/'

const soap =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:tns="' +
  ns +
  '">' +
  '<soap12:Body>' +
  '<tns:' +
  opName +
  '/>' +
  '</soap12:Body>' +
  '</soap12:Envelope>'

console.log('endpoint', endpoint)
console.log('op', opName)

const resp = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/soap+xml; charset=utf-8',
    accept: 'application/soap+xml, text/xml, application/xml',
  },
  body: soap,
})

console.log('HTTP', resp.status, resp.headers.get('content-type'))
const text = await resp.text()
console.log('xmlLen', text.length)
console.log('xmlStart', text.slice(0, 500).replace(/\s+/g, ' ').trim())

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: false,
  trimValues: true,
  parseTagValue: false,
})

const parsed = parser.parse(text)
const envKey = Object.keys(parsed).find((k) => k.toLowerCase().includes('envelope'))
const env = envKey ? parsed[envKey] : null
if (!env || typeof env !== 'object') throw new Error('Missing Envelope')

const bodyKey = Object.keys(env).find((k) => k.toLowerCase().includes('body'))
const body = bodyKey ? env[bodyKey] : null
if (!body || typeof body !== 'object') throw new Error('Missing Body')

console.log('bodyKeys', Object.keys(body))

const responseKey = Object.keys(body).find((k) => k.toLowerCase().endsWith('response'))
console.log('responseKey', responseKey)

const response = responseKey ? body[responseKey] : null
if (!response || typeof response !== 'object') {
  console.log('No response object; body=', body)
  process.exit(0)
}

console.log('responseKeys', Object.keys(response))
const ret = response.return

if (Array.isArray(ret)) {
  console.log('returnCount', ret.length)
  console.log('first', ret[0])
} else {
  console.log('returnType', typeof ret)
  console.log('returnVal', ret)
}
