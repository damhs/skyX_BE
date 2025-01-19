CREATE TABLE `User` (
	`id`	VARCHAR(20) NOT NULL,
	`password`	VARCHAR(100),
	`nickname`	VARCHAR(20),
	`profileURL`	VARCHAR(100),
	`updatedAt`	DATETIME
);


CREATE TABLE `Flight` (
	`flightID`	VARCHAR(36)	NOT NULL,
	`id`	VARCHAR(20)	NOT NULL,
	`originID`	VARCHAR(36)	NOT NULL,
	`destinationID`	VARCHAR(36)	NOT NULL,
	`updatedAt`	DATETIME	NULL
);

CREATE TABLE `Place` (
	`placeID`	VARCHAR(36)	NOT NULL,
	`placeName`	VARCHAR(20)	NULL,
	`latitude`	DECIMAL(13,10)	NULL,
	`longitude`	DECIMAL(13,10)	NULL,
	`altitude`	INT NULL,
	`etc`	VARCHAR(255)	NULL
);

CREATE TABLE `Favorite` (
	`favoriteID`	VARCHAR(36)	NOT NULL,
	`placeID`	VARCHAR(36)	NOT NULL,
	`id`	VARCHAR(20)	NOT NULL,
	`favoriteName`	VARCHAR(20)	NULL,
	`updatedAt`	DATETIME	NULL
);

CREATE TABLE `Recent` (
	`recentID`	VARCHAR(36)	NOT NULL,
	`placeID`	VARCHAR(36)	NOT NULL,
	`id`	VARCHAR(20)	NOT NULL,
	`updatedAt`	DATETIME	NULL
);

CREATE TABLE `FlightLog` (
	`flightLogID`	VARCHAR(36)	NOT NULL,
	`flightID`	VARCHAR(36)	NOT NULL,
	`latitude`	DECIMAL(13,10)	NULL,
	`longitude`	DECIMAL(13,10)	NULL,
	`altitude`	INT NULL,
	`speed`	INT NULL
);

CREATE TABLE `Building` (
	`buildingID`	VARCHAR(36)	NOT NULL,
	`latitude`	DECIMAL(13,10)	NULL,
	`longitude`	DECIMAL(13,10)	NULL,
	`radius`	INT NULL,
	`height`	INT NULL
);

ALTER TABLE `Building` ADD CONSTRAINT `PK_BUILDING` PRIMARY KEY (
	`buildingID`
);

ALTER TABLE `User` ADD CONSTRAINT `PK_USER` PRIMARY KEY (
	`id`
);

ALTER TABLE `Flight` ADD CONSTRAINT `PK_FLIGHT` PRIMARY KEY (
	`flightID`
);

ALTER TABLE `Place` ADD CONSTRAINT `PK_PLACE` PRIMARY KEY (
	`placeID`
);

ALTER TABLE `Favorite` ADD CONSTRAINT `PK_FAVORITE` PRIMARY KEY (
	`favoriteID`
);

ALTER TABLE `Recent` ADD CONSTRAINT `PK_RECENT` PRIMARY KEY (
	`recentID`
);

ALTER TABLE `FlightLog` ADD CONSTRAINT `PK_FLIGHTLOG` PRIMARY KEY (
	`flightLogID`
);

ALTER TABLE `Flight` ADD CONSTRAINT `FK_User_TO_Flight_1` FOREIGN KEY (
	`id`
)
REFERENCES `User` (
	`id`
);

ALTER TABLE `Flight` ADD CONSTRAINT `FK_Place_TO_Flight_1` FOREIGN KEY (
	`originID`
)
REFERENCES `Place` (
	`placeID`
);

ALTER TABLE `Flight` ADD CONSTRAINT `FK_Place_TO_Flight_2` FOREIGN KEY (
	`destinationID`
)
REFERENCES `Place` (
	`placeID`
);

ALTER TABLE `Favorite` ADD CONSTRAINT `FK_Place_TO_Favorite_1` FOREIGN KEY (
	`placeID`
)
REFERENCES `Place` (
	`placeID`
);

ALTER TABLE `Favorite` ADD CONSTRAINT `FK_User_TO_Favorite_1` FOREIGN KEY (
	`id`
)
REFERENCES `User` (
	`id`
);

ALTER TABLE `Recent` ADD CONSTRAINT `FK_Place_TO_Recent_1` FOREIGN KEY (
	`placeID`
)
REFERENCES `Place` (
	`placeID`
);

ALTER TABLE `Recent` ADD CONSTRAINT `FK_User_TO_Recent_1` FOREIGN KEY (
	`id`
)
REFERENCES `User` (
	`id`
);

ALTER TABLE `FlightLog` ADD CONSTRAINT `FK_Flight_TO_FlightLog_1` FOREIGN KEY (
	`flightID`
)
REFERENCES `Flight` (
	`flightID`
);
