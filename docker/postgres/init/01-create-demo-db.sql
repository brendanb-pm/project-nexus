CREATE DATABASE nexus_demo;

\connect nexus_demo

CREATE TABLE nexus_local_environment_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  marker text NOT NULL CHECK (marker = 'NEXUS_LOCAL_DEMO_V1')
);

INSERT INTO nexus_local_environment_identity (marker)
VALUES ('NEXUS_LOCAL_DEMO_V1');
