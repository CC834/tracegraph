FROM node:22-alpine AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TRACEGRAPH_FRONTEND_DIST=/app/frontend/dist
WORKDIR /app
COPY backend/ /app/backend/
RUN python -m pip install --no-cache-dir /app/backend
COPY --from=web /build/frontend/dist/ /app/frontend/dist/
EXPOSE 8000
CMD ["uvicorn", "tracegraph.main:app", "--host", "0.0.0.0", "--port", "8000"]

