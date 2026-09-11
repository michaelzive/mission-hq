create table avatar (
  kid_id bigint primary key references kid(id),
  colour int not null default 0,
  slots text not null default '{}'   -- json: { "headgear": "cap", "eyes": "goggles", ... } values are cosmetic asset keys
);

create table cosmetic_item (
  id bigserial primary key,
  theme_code varchar(20) not null,   -- AIRSOFT | HERO | ANY
  slot varchar(20) not null,         -- headgear | eyes | body | back | background | title
  name varchar(60) not null,
  asset_key varchar(40) not null,
  price int not null default 0,      -- 0 with unlock_rank 0 = starter gear, owned by everyone
  unlock_rank_ordinal int not null default 0,
  unique (theme_code, slot, asset_key)
);

create table kid_cosmetic (
  kid_id bigint not null references kid(id),
  cosmetic_item_id bigint not null references cosmetic_item(id),
  acquired_at timestamptz not null default now(),
  primary key (kid_id, cosmetic_item_id)
);

insert into cosmetic_item (theme_code, slot, name, asset_key, price, unlock_rank_ordinal) values
 -- airsoft starters
 ('AIRSOFT','headgear','No headgear','none',0,0),('AIRSOFT','headgear','Field cap','cap',0,0),
 ('AIRSOFT','eyes','Plain','plain',0,0),
 ('AIRSOFT','body','Fatigues','base',0,0),
 ('AIRSOFT','background','Plain','none',0,0),
 -- airsoft purchasable / unlockable
 ('AIRSOFT','eyes','Goggles','goggles',30,0),('AIRSOFT','eyes','Shades','shades',60,1),
 ('AIRSOFT','headgear','Beanie','beanie',40,0),('AIRSOFT','headgear','Helmet','helmet',0,3),
 ('AIRSOFT','body','Tactical vest','vest',90,2),
 ('AIRSOFT','back','Backpack','pack',50,1),
 ('AIRSOFT','background','Camo','camo',80,1),('AIRSOFT','background','Night ops','night',0,4),
 ('AIRSOFT','title','Ghost','ghost',120,2),('AIRSOFT','title','Sharpshooter','sharpshooter',0,5),
 -- hero starters
 ('HERO','headgear','No mask','none',0,0),('HERO','headgear','Mask','mask',0,0),
 ('HERO','eyes','Plain','plain',0,0),
 ('HERO','body','Suit','base',0,0),
 ('HERO','background','Plain','none',0,0),
 -- hero purchasable / unlockable
 ('HERO','eyes','Visor','visor',30,0),('HERO','eyes','Star eyes','stars',60,1),
 ('HERO','headgear','Antenna','antenna',40,0),('HERO','headgear','Crown','crown',0,3),
 ('HERO','body','Cape','cape',90,2),
 ('HERO','back','Jetpack','jetpack',50,1),
 ('HERO','background','Starfield','starfield',80,1),('HERO','background','City skyline','city',0,4),
 ('HERO','title','Rookie','rookie',120,2),('HERO','title','Guardian','guardian',0,5);
