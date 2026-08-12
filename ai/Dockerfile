# CoopData AI Module — vLLM inference server
# Standalone deployable module. Serves an OpenAI-compatible /v1 endpoint.
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv git curl \
    && rm -rf /var/lib/apt/lists/*

# Install vLLM (includes OpenAI-compatible API server)
RUN pip install --no-cache-dir vllm

# Expose the OpenAI-compatible endpoint
EXPOSE 8000

ENTRYPOINT ["python3", "-m", "vllm.entrypoints.openai.api_server"]
