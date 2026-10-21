import { describe, it, expect } from 'vitest';
import { HEROES, TYPE_MASTERY, RELICS, RELIC_SETS, STALLS } from '../src/data';

/**
 * Hero and skill names already used by another game, which ours must never reuse. They are stored as the first
 * 12 hex digits of the SHA-256 of the lower-case name, so the list itself isn't spelled out here.
 */
const RESERVED = new Set([
  '00140e8d6e75', '00dd01b04c53', '016526330aaf', '03e2f394cbcc', '03e3a4d5f5df', '049aeebec8eb',
  '054442e3d5a9', '055d23ba009d', '061c73dea643', '069f2fb052b8', '06c604b332b3', '06c734cf1abc',
  '06deac5b8d4a', '0713efb47769', '0720160a82c8', '072a626ed2d6', '0950524b9c43', '0a743a6a7311',
  '0a7622cd7283', '0bd8b2e19931', '0d47cb2b29b6', '0d7ddc7730c9', '0dc10d5088fa', '0ee9fec9b921',
  '0f355df306d6', '0f4d84a3988e', '10ea908f48f8', '110886f00258', '12ef47def070', '13c536ceca64',
  '14d60ea71c94', '15b7b9d79e95', '16522c62ab88', '17b37e38e0b1', '1823bfd076fd', '1a9397eaf26b',
  '1b0616a189d4', '1c5483264189', '1e2103cb1cef', '1efd3ec8210d', '1f254faa04cf', '204bc5f22052',
  '20b866724467', '21390471085c', '2223b416866e', '2322faf222ec', '2405187a2ec2', '259784e8dc45',
  '25f67f02357a', '262feb252ec6', '269689e0d47f', '26d48f05edd4', '27890e4fd564', '27b509e6c5f2',
  '27d707ef97a7', '2a51cdb84253', '2c0cfebe4c90', '2c69e1a12918', '2cb0b6a64e77', '2cdbdd829107',
  '2d1fd0086934', '2f1d352b6106', '2f1ead26c61e', '2fd79f45cdec', '302c4b5c9cc7', '30a69a05e351',
  '30c9ce9e3833', '31179412fa4f', '3220ee69c6fa', '333ec834c72c', '33a83d47080c', '33c2818cf82e',
  '34ed05359f0a', '34f54b279dd0', '37a86d521641', '37bf51bfba46', '37e7702e5ce4', '37eacc416969',
  '37f35541f02a', '38a4c0332d9a', '3903f7257b06', '395fbbcf27c8', '39f93384afd7', '3b7cce781caa',
  '3c7821c49940', '3fc449e2ac11', '40b9b76cf9b7', '40ddecbf8e07', '411c5c7bf951', '42099d195984',
  '43b61104928d', '44b0366f422f', '44b312a913c1', '4596a25392a3', '45b4079bbc54', '45cba851a81d',
  '46711b3061be', '471358524c72', '481084ee7330', '4812ffb1bdc8', '48b2769a272c', '4a6cd44f912c',
  '4aaba53ff2e4', '4ac134964872', '4bd18934da46', '4db4f7fc0507', '500b73299e1d', '509837a92131',
  '531fdc6e81ae', '537b7a87ac42', '54141373db1e', '5533cae50818', '556dcfa52d63', '5645b5553102',
  '56e723c16141', '5705f4aac584', '572c75f5017e', '58cc874ac0c0', '590b937bdafc', '59318d940594',
  '599f8341fe3e', '5a5502b400ab', '5ba64cf9f423', '5bdd4c1a6833', '5bf82da47113', '5d5bddb57710',
  '619be2966955', '61f0b9bd5b37', '61f989dbcb19', '622e41f33d3e', '62a01a0d552d', '63552d752949',
  '6365a4517385', '6381d762ea49', '63b7c7dad293', '63d04dee7c50', '644759d4f229', '64c313ab3166',
  '655834095fdc', '6583ae4d2d0c', '661081977d59', '68214fa01478', '690d24f1a8d2', '6915095b7d0b',
  '696e048322f8', '69d5f9985634', '69d9775a435b', '6a6b1e0aae9c', '6ba40a5286e4', '6bc27d1b9008',
  '6beec648e118', '6c5c980db5b6', '6c9393e25a90', '6c9c9f512780', '6d1c58595508', '6d9c449ebf0d',
  '6f46a730a6ae', '6fa1ae5740ee', '70548f36a9d4', '720e8c5da0da', '7358bd4ec877', '74f6e1e63675',
  '75a05c896e6d', '779cba5eeeba', '77b5ac508ba2', '781a64d9903b', '78225e77f980', '784d804bc463',
  '7879a4dc1639', '793da17aec26', '7957bdf8ea97', '798552d3924a', '7a3b4ee320a2', '7a56a5736797',
  '7acda864da7c', '7af92a50293a', '7c2914e5f29b', '7cd58cdd64a3', '7d445240c97c', '7d8520b5e1ad',
  '7eccb405e0c7', '7eefd589f525', '7f7c4084de1c', '8174a2a2c92c', '850b6dbe17b3', '8725dce31976',
  '87d2158f0988', '87f500fbb1c4', '8a0dbe531916', '8a4262979b06', '8ab9be0fbc68', '8baab38eecdb',
  '8c0a0dd7bde3', '8c0f0d715698', '8ccbd451cb25', '8cf2ca0f8fbd', '8dab3b5eb98f', '8db049dc816a',
  '8db54b98f7c1', '8ddaaab1b4e1', '8dffd82a061e', '8e0adad39788', '8e12a2a07545', '8e51bb3e0a9e',
  '8f613377728d', '90be41df71d7', '9134869a9ea2', '92130cd15586', '925149faf778', '92f473809e59',
  '94d8fe2cffbe', '94fd9624a102', '9559ec995dc7', '978195677a26', '97a82c9b5004', '9abbe8009894',
  '9ae528f05703', '9b80aa493f31', '9d88cd3c3218', '9ecb9081d9ac', '9ee02cf58b3e', '9fe15bcbe6aa',
  'a0cc063a6d94', 'a2451f82be89', 'a2546a03d628', 'a25c34385688', 'a33603bf79f7', 'a3de2172b921',
  'a44c47b1ee24', 'a4589a1c5bba', 'a642159823ab', 'a67d59a37d4f', 'a6b0c76283ff', 'a6bfef32d57b',
  'a7a43d88fdb4', 'a912c53aa27f', 'ac4e27653818', 'acec0c0a7439', 'af0e5f8f335a', 'af2a05659dea',
  'af31a4f74ecb', 'b06bbc9ca81c', 'b0cc9754bbe7', 'b1f51a511f1d', 'b20dd2351cc3', 'b315e910f8d8',
  'b37e5fdf55b2', 'b4664c2d694a', 'b4b101f4b6a4', 'b57be72309bc', 'b5ab1fdad9ed', 'b63469ee2a61',
  'b765e48535a9', 'b819c05a1790', 'b876c4fcae78', 'b94502859e91', 'b99bf3108c8d', 'b9e40e48939d',
  'bb82dbff5378', 'bb93cff8851d', 'bbd747645957', 'bc9e1645b10c', 'bdd74ae4184a', 'bf099ae3ae4b',
  'bf767b750c62', 'bfc047556aa3', 'c07bb1ea023e', 'c17a4a4ad844', 'c353a22d2c96', 'c395f9e1d40f',
  'c57022e58322', 'c59983b6970c', 'c5f952f289fb', 'c6f97c07c604', 'c7c9744ef928', 'c7e5beeb4d28',
  'c8b27e060461', 'c9531855c20f', 'c9d48c9ed331', 'ca5bcec12f71', 'ca8b22d0db83', 'cb99f31171c1',
  'cc17211e38d2', 'cc216979c998', 'cccaf8fcd57e', 'cce001ca851e', 'ccf0fa6cbc62', 'ceb54cd5bf1f',
  'd04c1371d080', 'd139d77cc805', 'd1bd06923817', 'd22ad7ca2a00', 'd274eceb5021', 'd2c52c7440e3',
  'd506d2007a9b', 'd58075446833', 'd5efc1eb3834', 'd60a1954b25b', 'd60f1242c4e4', 'd638549457e2',
  'd63c1b2b3dd1', 'd647c99605ed', 'd78b462faf82', 'd78d6af2633a', 'd81bc59a7f48', 'd93e85430262',
  'd96f73ece993', 'db0b52cab52a', 'db4ff468f52f', 'db83ea758bac', 'dbe3332bbebf', 'dbe79c3ae186',
  'dbfe648b12a8', 'dca4d20474f7', 'dd44fb66ba0e', 'dd51b6ecf351', 'ddfc40d428e8', 'de1d1077eb7f',
  'de3ec881af3d', 'ded46b09ccbe', 'df04371a3132', 'dff72ea69f70', 'e12409136b84', 'e1bec087e777',
  'e1fe7e6fd6f4', 'e3950a880c29', 'e3e84ff372c1', 'e4009e8e3157', 'e41bcb764578', 'e4c3c153699b',
  'e4d916fa9d2e', 'e4fdfbc95077', 'e6312e9d6d9b', 'e706d0dcbe33', 'eb25baf21492', 'ebb8706177cc',
  'ec356870ef20', 'ec56b34f2f46', 'eeb29844f62a', 'eec2d663eab1', 'f053d17703fc', 'f1144af56f7f',
  'f2b0d4bd4a1c', 'f2e283a9dd6a', 'f36ae0b5df6d', 'f441cace4f84', 'f4439ac77601', 'f44f98f3792a',
  'f46305b60242', 'f478f91c92f4', 'f50342faa9f4', 'f680777a0ffd', 'f8d2edad920b', 'f994b56b430e',
  'fa3c0c487282', 'fb27427ec2fd', 'fb49b737c8c5', 'fc364ba43d7a', 'fdcaab0d757c', 'fe46ff8be472',
  'fed1bf7579c8',
]);
async function key(name: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name.trim().toLowerCase()));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

describe('original names', () => {
  it('no hero, skill, relic or stall uses a reserved name', async () => {
    const names: string[] = [];
    for (const h of HEROES) {
      names.push(h.name);
      for (const s of [h.basic, h.ultimate, h.trait, h.sp1, h.sp2, h.aura]) if (s) names.push(s.name);
    }
    for (const m of Object.values(TYPE_MASTERY)) names.push(m.name);
    for (const r of RELICS) names.push(r.name);
    for (const s of RELIC_SETS) names.push(s.name);
    for (const s of STALLS) names.push(s.name);
    expect(names.length).toBeGreaterThan(700);
    const keys = await Promise.all(names.map(key));
    expect(names.filter((_, i) => RESERVED.has(keys[i]))).toEqual([]);
  });
});
