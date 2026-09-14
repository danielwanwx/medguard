# MedGuard on Amazon Bedrock AgentCore Runtime

`main.py` wraps the real MedGuard Strands agent (Nova Pro + 4 live-official-source tools)
in a `BedrockAgentCoreApp` entrypoint. Payload: `{"scan","profile":{meds,conditions},"selected_id"?}`.

Contract-tested locally:
```bash
AWS_PROFILE=<profile> AWS_REGION=us-west-2 python -c "import agentcore_runtime.main as m; \
  print(m.handle({'scan':'moringa','profile':{'meds':['warfarin'],'conditions':['hypertension']}}))"
```

Deploy (needs an AWS role with ECR + CodeBuild + bedrock-agentcore permissions):
```bash
pip install bedrock-agentcore bedrock-agentcore-starter-toolkit
agentcore configure --create -e agentcore_runtime/main.py -n medguard \
  -er <execution-role-arn> --requirements-file agentcore_runtime/requirements.txt -r us-west-2
agentcore deploy            # builds ARM64 container via CodeBuild, pushes ECR, creates the runtime
agentcore invoke '{"scan":"moringa","profile":{"meds":["warfarin"],"conditions":[]}}'
```
The local dev machine's sandbox role can InvokeModel (the agent runs) but lacks deploy-time
ECR/CodeBuild/memory permissions; deploy from a role that has them.
