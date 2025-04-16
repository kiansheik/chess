DOCKER="docker"
IMAGE_NAME="kiansheik/chess"
TAG_NAME="production"

REPOSITORY=""
FULL_IMAGE_NAME=${IMAGE_NAME}:${TAG_NAME}

lint:
	echo 'kiansheik.io' > CNAME
	black .

push:
	make lint
	git add .
	git commit
	git push origin HEAD
