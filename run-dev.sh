#!/bin/bash
cd /home/z/my-project

# Double fork to truly daemonize
(
  setsid bash -c 'exec bun run dev >> /home/z/my-project/dev.log 2>&1' < /dev/null > /dev/null 2>&1 &
  disown
) &
disown
exit 0
