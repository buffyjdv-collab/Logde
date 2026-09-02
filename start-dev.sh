#!/bin/bash
unset DATABASE_URL
unset DIRECT_URL
cd /home/z/my-project
exec /home/z/my-project/node_modules/.bin/next dev -p 3000
