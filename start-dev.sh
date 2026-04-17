#!/bin/bash
cd /home/z/my-project
exec bun run dev >> dev.log 2>&1
