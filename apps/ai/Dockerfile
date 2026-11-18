FROM python:3.13-slim
WORKDIR /app
COPY apps/ai/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY apps/ai /app/apps/ai
COPY content /app/content
ENV PYTHONPATH=/app/apps/ai
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
