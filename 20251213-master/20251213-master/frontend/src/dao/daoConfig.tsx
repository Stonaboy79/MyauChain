// src/dao/daoConfig.ts

export const daoConfig = {
  /**
   * =================================================
   * Global DAO（全体DAO）
   * =================================================
   */

  // platform モジュールが入っている package
  govPkgId:
    '0x96522bcfdf2e3e3e53006c4f0ff1e09ac7919016c60e10142e573fc221f69e15',

  // stay_mock package (Check-in機能)
  stayPkgId:
    '0x4ca93f862d7429b6bd8447882e08afd703dbbbe94480e839ebc31f8aa37dfc26',

  // GlobalGovState（shared）
  globalGovStateId:
    '0x0097c6033984331b60a3c6535c8013d9e5bfa0ffcb702d37943afcfe122273e5',

  /**
   * =================================================
   * Region DAO（地方DAO）
   * =================================================
   */

  // region_dao モジュールが入っている package
  platformPkgId:
    '0x96522bcfdf2e3e3e53006c4f0ff1e09ac7919016c60e10142e573fc221f69e15',

  // Region 1 の RegionDaoState（shared）
  regionDaoStateId:
    '0x8a6abb25c45a0b97fd9196f97213140b618ab86468e70c5ff6c413477a165ca8',

  /**
   * =================================================
   * 以下は UI では直接使っていないが、
   * スクリプト / 管理画面 / 将来拡張でほぼ確実に使う
   * =================================================
   */

  // PlatformAdminCap（事業主が保持）
  platformAdminCapId:
    '0xf1600e40fc6f6f4ac079685721a30e01ab48dc7a0c70a2d6abbc294539d49b1a',

  // GlobalDaoState（shared）
  globalDaoStateId:
    '0x161cfdc9e6e3bb3c334afbe0cbe235e29808beb8498efca268c69b9787a05901',

  // RegionAdminCap（事業主・デモ用）
  regionAdminCapId:
    '0xf34490f5d828e1b3b22f4153d461c7a0889fb8575372b28454f8b24f325a463f',

  // RegionIssuerCap（自治体が保持）
  regionIssuerCapId:
    '', // TODO: Add if needed, likely owned by deployer

  /**
   * =================================================
   * Demo User（参考）
   * =================================================
   */
  demoUser: {
    address:
      '0x2367f7dc199874c16ac6d36e5f9b8671dad1c9623d82880cd1b3e2fd1cfcc6dc',

    residentPassId:
      '', // Fill this if you mint one
  },
} as const;
