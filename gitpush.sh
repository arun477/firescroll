#!/bin/bash

MSG="${1:-Auto commit}"

git add -A
git commit -m "$MSG"
git push origin main
