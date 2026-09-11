insert into household (name) values ('Home');
insert into kid (household_id, callsign, theme_code, streak_days) values (1,'Viper','AIRSOFT',5),(1,'Nova','HERO',3);
insert into behaviour (household_id, title, points, kind) values
 (1,'Homework done',20,'DAILY'),(1,'20 minutes reading',15,'DAILY'),(1,'Revise for a test',30,'BONUS');
update behaviour set bonus_date = current_date where kind='BONUS';
insert into reward (kid_id,name,category,estimated_cost,price,tier,status,is_term_goal) values
 (1,'Bag of BBs','GEAR',120,120,1,'ACTIVE',false),(1,'Extra 30 min game time','GAME_TIME',null,40,1,'ACTIVE',false),
 (1,'M4 upgrade kit','GEAR',800,800,3,'ACTIVE',true),
 (2,'Comic book','GEAR',90,90,1,'ACTIVE',false),(2,'Build-a-tower set','GEAR',650,650,3,'ACTIVE',true);
insert into squad_goal (household_id,name,target_points,season_name) values (1,'Family airsoft day',1500,'Season 1');
insert into device (kid_id, device_token, paired_at) values (1,'dev-token-viper',now()),(2,'dev-token-nova',now());
