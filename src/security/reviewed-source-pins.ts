/** ADR 0028: exact deployed runtime certificates; source matching never grants risk clearance.
 * Reproduced by scripts/verify-bstocks-governance-sources.mjs. Changing a certificate
 * changes approval/review fingerprints. No caller-provided source pin is trusted. */
export const REVIEWED_BSC_SOURCES = Object.freeze([
  {
    "address": "0x156d6dce9a4f6139a3406f1f021f1a4880de93a3",
    "codeHash": "0x80fbad22136c0abdce6e0f3cc46cd0572318e01b92dbd5b4d5795ef6e8808711",
    "certificate": {
      "version": 1,
      "reportDigest": "b472d98513bec8692281bf86abc3c352227ba85a498813d57576d38386001480",
      "compiler": "0.8.24+commit.e11b9ed9.Emscripten.clang",
      "contractName": "UpgradeableBeacon",
      "inputDigest": "ac4a8dc65bb66b0c1bb8b38ee80f92741e8d51491e23743eeea8254162b0ce36",
      "compiledCodeHash": "0x80fbad22136c0abdce6e0f3cc46cd0572318e01b92dbd5b4d5795ef6e8808711",
      "executableCodeHash": "0x3709ef153ea1431de2637c14cddfa22467ae00c9d9c756344ffbf5bc0bf8951e",
      "exactMatch": true,
      "executableMatch": true
    },
    "sourceDigest": "776d270b713beef7d878f56478dfff74b9a763a3b34ad95cd4dbad1a0389f2dc"
  },
  {
    "address": "0x5948602680fe4aea08d98302337a2715b3aadad1",
    "codeHash": "0x1fbdf1bd87186de14b3caf88cf1e6fb123c5ab1d105cbd83c8ee092b90496f4c",
    "certificate": {
      "version": 1,
      "reportDigest": "b472d98513bec8692281bf86abc3c352227ba85a498813d57576d38386001480",
      "compiler": "0.8.4+commit.c7e474f2.Emscripten.clang",
      "contractName": "UpgradeableProxy",
      "inputDigest": "9d9993389d79af8e4a2dac66a59deebf5ec13fd25bddd6e9d419090fe7feda22",
      "compiledCodeHash": "0xa50bd9ffc2f47ba77c6ea512ab06a5ea778db1786edb9d48925a5de1de43e9a3",
      "executableCodeHash": "0xea6880d8b9121997313206a52edfc4e1d9e6249fa132e071a36eb61aa7cae722",
      "exactMatch": false,
      "executableMatch": true
    },
    "sourceDigest": "f6d58cadfa941571ac2afb5133238b1a4ae08f18328351e91a033b226e74d824"
  },
  {
    "address": "0xc94e485510c458860f89d23dcb8dd34bd10e6b8b",
    "codeHash": "0x1fbdf1bd87186de14b3caf88cf1e6fb123c5ab1d105cbd83c8ee092b90496f4c",
    "certificate": {
      "version": 1,
      "reportDigest": "b472d98513bec8692281bf86abc3c352227ba85a498813d57576d38386001480",
      "compiler": "0.8.4+commit.c7e474f2.Emscripten.clang",
      "contractName": "UpgradeableProxy",
      "inputDigest": "9d9993389d79af8e4a2dac66a59deebf5ec13fd25bddd6e9d419090fe7feda22",
      "compiledCodeHash": "0xa50bd9ffc2f47ba77c6ea512ab06a5ea778db1786edb9d48925a5de1de43e9a3",
      "executableCodeHash": "0xea6880d8b9121997313206a52edfc4e1d9e6249fa132e071a36eb61aa7cae722",
      "exactMatch": false,
      "executableMatch": true
    },
    "sourceDigest": "55fb260da6bdddb004be27c14a2ff2886d08604f0fc753b63b54250266fe80e6"
  },
  {
    "address": "0xd00eb2a87e7b699b75be975c2edae47d36cf07dd",
    "codeHash": "0x62306a3b415ff530c75f6d19a5f7bf81b0170f79f9d5390a975681952d5ed14e",
    "certificate": {
      "version": 1,
      "reportDigest": "b472d98513bec8692281bf86abc3c352227ba85a498813d57576d38386001480",
      "compiler": "0.8.4+commit.c7e474f2.Emscripten.clang",
      "contractName": "OperatorWallet",
      "inputDigest": "fb18301521a5ebdf0d61746f9889ff63ea84d7fc51467d3946a3fef68b8efebb",
      "compiledCodeHash": "0x62306a3b415ff530c75f6d19a5f7bf81b0170f79f9d5390a975681952d5ed14e",
      "executableCodeHash": "0xaf142d2801d87706fcff3d7df2feb8cfb9c0526acb891652b19aeded94a4fd75",
      "exactMatch": true,
      "executableMatch": true
    },
    "sourceDigest": "cf23c1b095cf1a4652ffb0d7d080a2b051d1a2f49cf6d6657d5b7a20696ad070"
  },
  {
    "address": "0x72f6389c01bffce7698fa5135cbf75191fe56d17",
    "codeHash": "0x96a9ae86498d2b071724cd3a005526a9a850b0198924362418b708cc1332e26c",
    "certificate": {
      "version": 1,
      "reportDigest": "b472d98513bec8692281bf86abc3c352227ba85a498813d57576d38386001480",
      "compiler": "0.8.4+commit.c7e474f2.Emscripten.clang",
      "contractName": "BurnWallet",
      "inputDigest": "3088fa4b89d1517d0c3b8eebedf581872ffa8fd88714402b23777bec4ee1a064",
      "compiledCodeHash": "0xb31b3d85af1cf04f68395843eba5d545c8cf852e5d0bda5ea78c9181743f5596",
      "executableCodeHash": "0x9fb068feaf1135a476592a6122d0b5f14f5d8c52c31ffef6cb974c41b35d1fa1",
      "exactMatch": false,
      "executableMatch": true
    },
    "sourceDigest": "221989fb96084c3b2245de3ad26c23cf3b147f94fffa9cbf9102ffe15c35bfa9"
  }
].map(pin => Object.freeze({ ...pin, certificate: Object.freeze(pin.certificate) })));

export function reviewedSourcePin(address: string, codeHash: string) {
  return REVIEWED_BSC_SOURCES.find(pin => pin.address === address && pin.codeHash === codeHash);
}
