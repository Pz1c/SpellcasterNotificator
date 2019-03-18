CREATE TABLE sn_user
(
    user_id int(15) NOT NULL auto_increment,
    facebook_uid int(20),
    last_msg_date int(10) DEFAULT 0,
    delay_level int(3) DEFAULT 0,
    hint_show int(1) DEFAULT 0,
    sleep int(1) DEFAULT 0,
    
    primary key(user_id)
);

CREATE TABLE sn_warlock
(
    warlock_id int(15) NOT NULL auto_increment,
    login varchar(250) NOT NULL,
    
    primary key(warlock_id)
);

CREATE TABLE sn_warlock_listener
(
    user_id int(15) NOT NULL,
    warlock_id int(15) NOT NULL,
    
    PRIMARY KEY (user_id, warlock_id)
);