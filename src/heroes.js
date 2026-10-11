// Playable heroes. Each hero is a character model plus a signature weapon; the weapon's flight
// (simulation) comes from weapons.js, the hero adds the look: what it holds (`hold` = names of the
// props baked into its KayKit model; the rest are hidden), the projectile model and color.
// proj.spin is how the thrown object turns in flight: 'tumble' (end over end), 'disc' (flat, like a
// frisbee), 'point' (tip first), 'whirl' (flat helicopter spin) or 'roll'; proj.len is its length in
// meters. heldProp is the prop in the hand that is the projectile (hidden while it flies); handCopy
// puts a small copy of the projectile in the hand instead.

export const HEROES = [
  {
    id: 'barbarian', name: 'Варвар', model: 'Barbarian', weapon: 'ricochet', unlock: 0,
    weaponName: 'Топор-рикошет', desc: 'Топор летит прямо и 3 раза отскакивает',
    hold: ['1H_Axe'], proj: { kit: 'props', model: 'axe_1handed', spin: 'tumble', len: 0.75 }, heldProp: '1H_Axe', color: 0xffb347, shoot: 'Throw',
  },
  {
    id: 'stonemage', name: 'Маг камней', model: 'Mage', tint: 0xb8a58c, weapon: 'blackhole', unlock: 0,
    weaponName: 'Гравитационный валун', desc: 'Валун стягивает врагов и взрывается',
    hold: ['2H_Staff', 'Spellbook'], proj: { kit: 'hex', model: 'rock_single_A', spin: 'roll' }, color: 0xc9a46a, shoot: 'Spellcast_Shoot',
  },
  {
    id: 'knight', name: 'Рыцарь', model: 'Knight', weapon: 'boomerang', unlock: 300,
    weaponName: 'Щит-бумеранг', desc: 'Щит летит дугой и сам возвращается',
    hold: ['1H_Sword', 'Round_Shield'], proj: { kit: 'props', model: 'shield_round', spin: 'disc', len: 0.6 }, heldProp: 'Round_Shield', color: 0x5fe0ff, shoot: 'Throw',
  },
  {
    id: 'rogue', name: 'Разбойник', model: 'Rogue', weapon: 'snake', unlock: 800,
    weaponName: 'Кинжал-змея', desc: 'Кинжал виляет волной, 2 отскока',
    hold: ['Knife', 'Knife_Offhand'], proj: { kit: 'props', model: 'dagger', spin: 'point', len: 0.6 }, heldProp: 'Knife', color: 0x7dff6a, shoot: 'Throw',
  },
  {
    id: 'ranger', name: 'Следопыт', model: 'Rogue_Hooded', weapon: 'spiral', unlock: 1500,
    weaponName: 'Вихрь-клинок', desc: 'Клинок раскручивается спиралью у цели',
    hold: ['Knife_Offhand'], proj: { kit: 'props', model: 'sword_1handed', spin: 'whirl', len: 0.9 }, handCopy: true, color: 0xff7ad9, shoot: 'Throw',
  },
  {
    id: 'stormmage', name: 'Маг молний', model: 'Mage', weapon: 'lightning', unlock: 2500,
    weaponName: 'Цепная молния', desc: 'Перескакивает до 6 врагов',
    hold: ['2H_Staff'], proj: { orb: true }, color: 0x9fb4ff, shoot: 'Spellcast_Shoot',
  },
  {
    id: 'firemage', name: 'Маг огня', model: 'Mage', tint: 0xff8a66, weapon: 'orbit', unlock: 4000,
    weaponName: 'Огненная орбита', desc: 'Огненный шар кружит вокруг тебя',
    hold: ['1H_Wand', 'Spellbook_open'], proj: { orb: true }, color: 0xff8a3a, shoot: 'Spellcast_Shoot',
  },
];

// Old saves and challenge links stored a weapon id; map it to the hero that carries that weapon.
export const getHero = (id) => HEROES.find((h) => h.id === id) || HEROES.find((h) => h.weapon === id) || HEROES[0];
