#!/usr/bin/env node
const { spawn, execSync } = require('child_process')

const args = process.argv.slice(2)
const INTERACTIVE = args.includes('-i')
const ISSUE_ID = args.find(a => a !== '-i')

if (!ISSUE_ID) {
  console.log(`Usage: loop.cjs <beads-issue-id> [-i]

Options:
  -i    Interactive mode (full Claude UI instead of JSON stream)

Example:
  node loop.cjs 01acc-1i7
  node loop.cjs all
  node loop.cjs all -i
`)
  process.exit(1)
}

const MAX_ITERATIONS = 30

// colors - using 24-bit true color to match Claude Code palette
const orange = (t) => `\x1b[38;2;232;131;103m${t}\x1b[0m`  // coral/salmon #E88367
const dim = (t) => `\x1b[2m${t}\x1b[0m`
const cyan = (t) => `\x1b[38;2;130;170;200m${t}\x1b[0m`
const green = (t) => `\x1b[38;2;108;184;108m${t}\x1b[0m`   // muted sage green
const yellow = (t) => `\x1b[38;2;220;180;100m${t}\x1b[0m`
const red = (t) => `\x1b[38;2;220;100;100m${t}\x1b[0m`
const bold = (t) => `\x1b[1m${t}\x1b[0m`

const log = (msg) => console.log(`${orange('✦')} ${msg}`)
const indent = (text, prefix = '  ') => text.split('\n').map(l => prefix + l).join('\n')

// known properties to ignore at event level
const IGNORED_EVENT_PROPS = ['session_id', 'uuid', 'parent_tool_use_id']

// known properties to ignore in message object
const IGNORED_MESSAGE_PROPS = ['id', 'type', 'role', 'stop_reason', 'stop_sequence', 'context_management', 'container']

const hasUnknownKeys = (obj, knownKeys) => Object.keys(obj).some(k => !knownKeys.includes(k))

const formatToolCall = (name, input) => {
  if (!input) return name
  if (input.command) {
    const cmd = input.command.length > 60 ? input.command.slice(0, 60) + '…' : input.command
    return `${name}(${cmd})`
  }
  if (name === 'Write' && input.file_path) return `${name}(${input.file_path})`
  if (name === 'Edit' && input.file_path) return `${name}(${input.file_path})`
  if (name === 'Read' && input.file_path) return `${name}(${input.file_path})`
  if (input.todos) return `${name}(${input.todos.length} todos)`
  if (input.file_path) return `${name}(${input.file_path})`
  if (input.pattern) return `${name}(${input.pattern})`
  return name
}

let lastToolId = null
let lastToolLine = null

const processContentBlock = (block) => {
  if (block.type === 'text') {
    console.log('')
    console.log(`⏺ ${block.text}`)
    return true
  }
  if (block.type === 'tool_use') {
    lastToolId = block.id
    lastToolLine = formatToolCall(block.name, block.input)
    // don't print yet - wait for result to know success/failure
    return true
  }
  if (block.type === 'tool_result') return true
  return false
}

let authFailed = false

const processAssistantEvent = (event) => {
  if (event.error) {
    console.log(`${yellow('⚠')} ${bold('Error:')} ${event.error}`)
    if (event.message?.content?.[0]?.text) {
      console.log(indent(dim(event.message.content[0].text), '  '))
    }
    if (event.error === 'authentication_failed') authFailed = true
    return
  }

  const msg = event.message
  if (!msg) {
    console.log(yellow(`[assistant] no message:`) + '\n' + JSON.stringify(event, null, 2))
    return
  }

  const eventKeys = Object.keys(event).filter(k => !IGNORED_EVENT_PROPS.includes(k))
  const knownEventKeys = ['type', 'message', 'error']
  if (hasUnknownKeys(Object.fromEntries(eventKeys.map(k => [k, event[k]])), knownEventKeys)) {
    const unknownKeys = eventKeys.filter(k => !knownEventKeys.includes(k))
    console.log(yellow(`[assistant] unknown event props: ${unknownKeys.join(', ')}`))
    console.log(dim(JSON.stringify(event, null, 2)))
    return
  }

  const msgKeys = Object.keys(msg).filter(k => !IGNORED_MESSAGE_PROPS.includes(k))
  const knownMsgKeys = ['model', 'content', 'usage']
  if (hasUnknownKeys(Object.fromEntries(msgKeys.map(k => [k, msg[k]])), knownMsgKeys)) {
    const unknownKeys = msgKeys.filter(k => !knownMsgKeys.includes(k))
    console.log(yellow(`[assistant] unknown message props: ${unknownKeys.join(', ')}`))
    console.log(dim(JSON.stringify(msg, null, 2)))
    return
  }

  const content = msg.content || []
  for (const block of content) {
    if (!processContentBlock(block)) {
      console.log(yellow(`[assistant] unknown content type: ${block.type}`))
      console.log(dim(JSON.stringify(block, null, 2)))
    }
  }
}

const processResultEvent = (event) => {
  const { total_cost_usd, cost_usd, duration_ms, num_turns, modelUsage } = event
  const cost = total_cost_usd ?? cost_usd
  const durationSec = duration_ms ? (duration_ms / 1000).toFixed(0) : null

  const parts = []
  if (durationSec) {
    const mins = Math.floor(durationSec / 60)
    const secs = durationSec % 60
    parts.push(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`)
  }
  if (cost !== undefined) parts.push(`$${cost.toFixed(2)}`)
  if (num_turns !== undefined) parts.push(`${num_turns} turns`)

  console.log(`✻ Baked for ${parts.join(' · ')}`)

  if (modelUsage && Object.keys(modelUsage).length > 1) {
    for (const [model, data] of Object.entries(modelUsage)) {
      const shortModel = model.replace('claude-', '').replace(/-\d{8}$/, '')
      console.log(dim(`  ${shortModel}: $${data.costUSD?.toFixed(2) || '?'}`))
    }
  }

  const knownResultProps = [
    'type', 'subtype', 'is_error', 'session_id', 'uuid',
    'cost_usd', 'total_cost_usd', 'total_tokens', 'duration_ms', 'duration_api_ms', 'num_turns',
    'result', 'usage', 'modelUsage', 'permission_denials'
  ]
  if (hasUnknownKeys(event, knownResultProps)) {
    const unknownKeys = Object.keys(event).filter(k => !knownResultProps.includes(k))
    console.log(yellow(`[result] unknown props: ${unknownKeys.join(', ')}`))
    console.log(dim(JSON.stringify(event, null, 2)))
  }
}

const processSystemEvent = (event) => {
  const { subtype } = event

  if (subtype === 'init') {
    const { model, cwd, tools, mcp_servers, claude_code_version } = event
    const shortModel = model?.replace('claude-', '').replace(/-\d{8}$/, '') || 'unknown'
    const version = claude_code_version || '?'
    const shortCwd = cwd?.replace(process.env.HOME, '~') || '?'
    const mcpConnected = mcp_servers?.filter(s => s.status === 'connected').map(s => s.name) || []

    console.log('')
    console.log(orange(' ▐▛███▜▌') + `   Claude Code v${version}`)
    console.log(orange('▝▜█████▛▘') + `  ${shortModel} · ${tools?.length || 0} tools`)
    console.log(orange('  ▘▘ ▝▝') + `    ${shortCwd}`)
    if (mcpConnected.length) console.log(dim(`           mcp: ${mcpConnected.join(', ')}`))
    console.log('')
    return
  }

  if (subtype === 'hook_started') {
    const { hook_name } = event
    console.log(`${dim('⟳')} ${dim(`hook: ${hook_name || 'unknown'}`)}`)
    return
  }

  if (subtype === 'hook_response') {
    // hook_started already printed the hook name, no need to print again on success
    const { hook_name, exit_code, stderr } = event
    if (exit_code !== 0) {
      console.log(`${yellow('⟳')} hook ${hook_name || 'unknown'} exit=${exit_code}`)
      if (stderr) console.log(indent(yellow(stderr.slice(0, 200)), '  '))
    }
    return
  }

  if (subtype === 'task_notification') {
    const { task_id, status, summary } = event
    const icon = status === 'completed' ? green('✓') : status === 'failed' ? red('✗') : dim('⏳')
    console.log(`${icon} ${dim(`task ${task_id}:`)} ${status}`)
    if (summary) console.log(indent(dim(summary.slice(0, 100)), '  '))
    return
  }

  console.log(dim(`[system:${subtype || '?'}] ${JSON.stringify(event).slice(0, 200)}`))
}

const formatDiff = (structuredPatch, filePath) => {
  const lines = []
  const totalAdded = structuredPatch.reduce((n, h) => n + h.lines.filter(l => l.startsWith('+')).length, 0)
  const totalRemoved = structuredPatch.reduce((n, h) => n + h.lines.filter(l => l.startsWith('-')).length, 0)

  lines.push(`  ⎿  Updated ${filePath || 'file'}`)
  if (totalAdded || totalRemoved) {
    lines.push(dim(`      ${totalAdded ? `+${totalAdded}` : ''} ${totalRemoved ? `-${totalRemoved}` : ''} lines`))
  }

  for (const hunk of structuredPatch.slice(0, 2)) {
    for (const line of hunk.lines.slice(0, 8)) {
      if (line.startsWith('+')) lines.push(`      ${green(line)}`)
      else if (line.startsWith('-')) lines.push(`      ${red(line)}`)
      else lines.push(`      ${dim(line)}`)
    }
    if (hunk.lines.length > 8) lines.push(dim(`      … +${hunk.lines.length - 8} lines`))
  }
  if (structuredPatch.length > 2) lines.push(dim(`      … +${structuredPatch.length - 2} more hunks`))
  return lines.join('\n')
}

const isToolSuccess = (event) => {
  const { tool_use_result } = event
  if (tool_use_result?.error) return false
  if (tool_use_result?.exit_code !== undefined) return tool_use_result.exit_code === 0

  const content = event.message?.content?.[0]
  if (content?.type === 'tool_result') {
    const text = typeof content.content === 'string' ? content.content : ''
    const exitMatch = text.match(/Exit code[:\s]+(\d+)/i)
    if (exitMatch) return exitMatch[1] === '0'
    if (content.is_error) return false
  }
  return true
}

const processUserEvent = (event) => {
  const { tool_use_result } = event

  // print the pending tool call line with colored circle
  if (lastToolLine) {
    const success = isToolSuccess(event)
    const circle = success ? green('⏺') : red('⏺')
    console.log('')
    console.log(`${circle} ${bold(lastToolLine)}`)
    lastToolLine = null
    lastToolId = null
  }

  if (tool_use_result?.agentId || (tool_use_result?.status === 'completed' && tool_use_result?.totalDurationMs)) {
    const { agentId, totalDurationMs, totalTokens } = tool_use_result
    const duration = totalDurationMs ? `${(totalDurationMs / 1000).toFixed(1)}s` : ''
    const tokens = totalTokens ? `${totalTokens} tokens` : ''
    console.log(`  ⎿  ${dim(`Agent ${agentId || '?'} completed ${duration} ${tokens}`)}`)
    return
  }

  if (tool_use_result?.structuredPatch) {
    console.log(formatDiff(tool_use_result.structuredPatch, tool_use_result.filePath))
    return
  }

  if (tool_use_result?.file) {
    const { filePath, numLines } = tool_use_result.file
    console.log(`  ⎿  ${dim(`${filePath} (${numLines} lines)`)}`)
    return
  }

  if (tool_use_result?.type === 'text' && !tool_use_result.file) {
    const preview = (tool_use_result.text || '').slice(0, 100)
    console.log(`  ⎿  ${preview}${preview.length >= 100 ? '...' : ''}`)
    return
  }

  const content = event.message?.content?.[0]
  if (content?.type === 'tool_result') {
    const text = typeof content.content === 'string'
      ? content.content
      : Array.isArray(content.content)
        ? content.content.find(c => c.type === 'text')?.text || ''
        : ''
    const firstLine = text.split('\n')[0]?.slice(0, 80) || ''
    if (firstLine) console.log(`  ⎿  ${firstLine}${firstLine.length >= 80 ? '...' : ''}`)
  }
}

const processEvent = (event) => {
  const { type } = event
  if (type === 'assistant') processAssistantEvent(event)
  else if (type === 'user') processUserEvent(event)
  else if (type === 'result') processResultEvent(event)
  else if (type === 'tool_result' && event.error) console.log(yellow(`[tool_result] error: ${event.error}`))
  else if (type === 'error') console.log(yellow(`[error] ${JSON.stringify(event)}`))
  else if (type === 'system') processSystemEvent(event)
  else {
    console.log(yellow(`[unknown type: ${type}]`))
    console.log(dim(JSON.stringify(event, null, 2)))
  }
}

const getBranchName = (issueId) => {
  // Sanitize issue ID for branch name
  return `feature/${issueId.replace(/[^a-zA-Z0-9._-]/g, '-')}`
}

const getCurrentBranch = () => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

const ensureFeatureBranch = (issueId) => {
  const targetBranch = getBranchName(issueId)
  const currentBranch = getCurrentBranch()

  if (currentBranch === targetBranch) {
    log(`Already on branch ${cyan(targetBranch)}`)
    return true
  }

  try {
    // Check if branch exists
    const branchExists = execSync(`git branch --list ${targetBranch}`, { encoding: 'utf8' }).trim()

    if (branchExists) {
      log(`Switching to existing branch ${cyan(targetBranch)}`)
      execSync(`git checkout ${targetBranch}`, { encoding: 'utf8' })
    } else {
      // Create from master (or main)
      const baseBranch = execSync('git branch --list master', { encoding: 'utf8' }).trim() ? 'master' : 'main'
      log(`Creating branch ${cyan(targetBranch)} from ${baseBranch}`)
      execSync(`git checkout -b ${targetBranch} ${baseBranch}`, { encoding: 'utf8' })
    }
    return true
  } catch (err) {
    log(`${red('Failed to setup branch:')} ${err.message}`)
    return false
  }
}

const buildPrompt = () => ISSUE_ID === 'all'
  ? `Pick the most important issue from \`bd list\` and implement it.

Requirements:
- Work in a feature branch (create one if needed: \`git checkout -b feature/<issue-id>\`)
- Write tests for the implemented functionality
- Make sure unit tests pass (\`npm test\`)
- Commit your changes with meaningful commit messages

When done, close it using \`bd close <id>\`.`
  : `Implement this beads task: ${ISSUE_ID}

Use \`bd show ${ISSUE_ID}\` to learn details of the task.

If it has children, pick the most important child task and work on it.

Requirements:
- Write tests for the implemented functionality
- Make sure unit tests pass (\`npm test\`)
- Commit your changes with meaningful commit messages

When it's done, close it using \`bd close <id>\`.`

const buildDocsPrompt = (issueId) => {
  return `The issue ${issueId} is now closed. Before creating a PR, write documentation for the implemented feature.

Steps:
1. Use \`bd show ${issueId}\` to understand what was implemented
2. Look at the changes made (use \`git diff master\` or check modified files)
3. Create documentation in the \`docs/\` folder:
   - Create a new file: \`docs/${issueId}.md\`
   - Use clear markdown structure with headers
   - Include: problem description, solution, code examples, usage
4. Commit the documentation changes

Documentation file structure:
\`\`\`markdown
# <Issue Title>

## Problem
<Description of the problem that was solved>

## Solution
<How the problem was solved>

## Changed Files
- \`path/to/file.ts\` — description of changes

## Usage
<Code examples or instructions if applicable>
\`\`\`

Focus on:
- What the feature/fix does
- Why it was needed
- How to use it (if applicable)
- Any configuration or environment variables needed`
}

const buildPRPrompt = (issueId) => {
  const branchName = getBranchName(issueId)
  return `Documentation is ready. Now create a Pull Request to merge the changes into master.

Steps:
1. Make sure all changes are committed (including docs)
2. Push the branch to remote: \`git push -u origin ${branchName}\`
3. Create a PR using: \`gh pr create --base master --title "feat: ${issueId}" --body "Closes ${issueId}"\`

After creating the PR, output the PR URL.`
}

const checkDone = () => {
  try {
    if (ISSUE_ID === 'all') {
      const output = execSync('bd list --json', { encoding: 'utf8' })
      const issues = JSON.parse(output)
      const openCount = issues.filter(i => i.status !== 'closed').length
      log(`Checking: ${openCount} open issues remaining`)
      return openCount === 0
    } else {
      const output = execSync(`bd show ${ISSUE_ID} --json`, { encoding: 'utf8' })
      const issues = JSON.parse(output)
      const status = issues[0]?.status
      log(`Checking issue ${ISSUE_ID}: status=${status}`)
      return status === 'closed'
    }
  } catch (err) {
    log(`Check failed: ${err.message}`)
    return false
  }
}

let prCreated = false
let docsWritten = false

const getClosedEpics = () => {
  try {
    // Use --all to include closed issues
    const output = execSync('bd list --all --json', { encoding: 'utf8' })
    const issues = JSON.parse(output)
    return issues.filter(i => i.status === 'closed' && i.issue_type === 'epic')
  } catch {
    return []
  }
}

const getCurrentEpic = () => {
  try {
    const output = execSync('bd list --json', { encoding: 'utf8' })
    const issues = JSON.parse(output)

    // Find epic that is in_progress
    const inProgressEpic = issues.find(i => i.issue_type === 'epic' && i.status === 'in_progress')
    if (inProgressEpic) return inProgressEpic

    // Find epic that has open/in_progress children (by checking issue ID prefix)
    const epics = issues.filter(i => i.issue_type === 'epic' && i.status === 'open')
    for (const epic of epics) {
      const hasActiveChildren = issues.some(i =>
        i.id.startsWith(epic.id + '.') &&
        (i.status === 'open' || i.status === 'in_progress')
      )
      if (hasActiveChildren) return epic
    }

    // Return first open epic
    return epics[0] || null
  } catch {
    return null
  }
}

let currentEpicId = null

const runDocsCreation = (issueId) => new Promise((resolve, reject) => {
  console.log('')
  log(`${'━'.repeat(50)}`)
  log(`Writing documentation for ${issueId}`)
  log(`${'━'.repeat(50)}`)

  const prompt = buildDocsPrompt(issueId)
  log(`Docs Prompt:`)
  console.log(indent(dim(prompt), '  '))

  log(`Spawning Claude for documentation${INTERACTIVE ? ' (interactive)' : ''}...`)

  const claudeArgs = INTERACTIVE
    ? ['--dangerously-skip-permissions', prompt]
    : ['-p', '--verbose', '--output-format=stream-json', '--dangerously-skip-permissions', prompt]

  const claude = spawn('claude', claudeArgs, {
    stdio: INTERACTIVE ? 'inherit' : ['inherit', 'pipe', 'inherit']
  })

  if (!INTERACTIVE) {
    let buffer = ''
    claude.stdout.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          processEvent(JSON.parse(line))
        } catch {
          console.log(dim(`[parse error] ${line}`))
        }
      }
    })

    claude.on('close', (code) => {
      if (buffer.trim()) {
        try { processEvent(JSON.parse(buffer)) } catch { console.log(dim(buffer)) }
      }
      log(`Claude (docs) exited with code ${code}`)
      docsWritten = true
      resolve()
    })
  } else {
    claude.on('close', (code) => {
      log(`Claude (docs) exited with code ${code}`)
      docsWritten = true
      resolve()
    })
  }

  claude.on('error', (err) => {
    log(`Failed to start Claude for docs: ${err.message}`)
    reject(err)
  })
})

const runPRCreation = (issueId) => new Promise((resolve, reject) => {
  console.log('')
  log(`${'━'.repeat(50)}`)
  log(`Creating Pull Request for ${issueId}`)
  log(`${'━'.repeat(50)}`)

  const prompt = buildPRPrompt(issueId)
  log(`PR Prompt:`)
  console.log(indent(dim(prompt), '  '))

  log(`Spawning Claude for PR creation${INTERACTIVE ? ' (interactive)' : ''}...`)

  const claudeArgs = INTERACTIVE
    ? ['--dangerously-skip-permissions', prompt]
    : ['-p', '--verbose', '--output-format=stream-json', '--dangerously-skip-permissions', prompt]

  const claude = spawn('claude', claudeArgs, {
    stdio: INTERACTIVE ? 'inherit' : ['inherit', 'pipe', 'inherit']
  })

  if (!INTERACTIVE) {
    let buffer = ''
    claude.stdout.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          processEvent(JSON.parse(line))
        } catch {
          console.log(dim(`[parse error] ${line}`))
        }
      }
    })

    claude.on('close', (code) => {
      if (buffer.trim()) {
        try { processEvent(JSON.parse(buffer)) } catch { console.log(dim(buffer)) }
      }
      log(`Claude (PR) exited with code ${code}`)
      prCreated = true
      resolve()
    })
  } else {
    claude.on('close', (code) => {
      log(`Claude (PR) exited with code ${code}`)
      prCreated = true
      resolve()
    })
  }

  claude.on('error', (err) => {
    log(`Failed to start Claude for PR: ${err.message}`)
    reject(err)
  })
})

const runIteration = (iteration) => new Promise((resolve, reject) => {
  console.log('')
  log(`${'━'.repeat(50)}`)
  log(`Iteration ${iteration}/${MAX_ITERATIONS}`)
  log(`${'━'.repeat(50)}`)

  // Ensure we're on the right feature branch
  if (ISSUE_ID !== 'all') {
    // For specific issue - create branch on first iteration
    if (iteration === 1) {
      ensureFeatureBranch(ISSUE_ID)
    }
  } else {
    // For 'all' mode - find current epic and ensure we're on its branch
    const epic = getCurrentEpic()
    if (epic) {
      if (currentEpicId !== epic.id) {
        currentEpicId = epic.id
        log(`Current epic: ${cyan(epic.id)} - ${epic.title}`)
        ensureFeatureBranch(epic.id)
      }
    } else {
      log(dim('No active epic found'))
    }
  }

  if (checkDone()) {
    log(ISSUE_ID === 'all' ? '✅ All issues closed.' : `✅ Issue ${ISSUE_ID} is closed.`)
    resolve({ done: true })
    return
  }

  const prompt = buildPrompt()
  log(`Prompt:`)
  console.log(indent(dim(prompt), '  '))

  log(`Spawning Claude${INTERACTIVE ? ' (interactive)' : ''}...`)

  const claudeArgs = INTERACTIVE
    ? ['--dangerously-skip-permissions', prompt]
    : ['-p', '--verbose', '--output-format=stream-json', '--dangerously-skip-permissions', prompt]

  const claude = spawn('claude', claudeArgs, {
    stdio: INTERACTIVE ? 'inherit' : ['inherit', 'pipe', 'inherit']
  })

  if (!INTERACTIVE) {
    let buffer = ''
    claude.stdout.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          processEvent(JSON.parse(line))
        } catch {
          console.log(dim(`[parse error] ${line}`))
        }
      }
    })

    claude.on('close', (code) => {
      if (buffer.trim()) {
        try { processEvent(JSON.parse(buffer)) } catch { console.log(dim(buffer)) }
      }
      log(`Claude exited with code ${code}`)
      resolve({ done: false })
    })
  } else {
    claude.on('close', (code) => {
      log(`Claude exited with code ${code}`)
      resolve({ done: false })
    })
  }

  claude.on('error', (err) => {
    log(`Failed to start Claude: ${err.message}`)
    reject(err)
  })
})

const main = async () => {
  console.log('')
  log(`${'═'.repeat(50)}`)
  log(`Starting Autonomous Loop${INTERACTIVE ? ' (interactive)' : ''}`)
  log(`Target: ${ISSUE_ID === 'all' ? 'all open issues' : ISSUE_ID}`)
  log(`Max iterations: ${MAX_ITERATIONS}`)
  log(`${'═'.repeat(50)}`)

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const result = await runIteration(i)

    if (authFailed) {
      log(`❌ Authentication failed. Run 'claude' and use /login to authenticate.`)
      process.exit(1)
    }

    // If task is done, write docs, create PR and exit
    if (result?.done && ISSUE_ID !== 'all') {
      log(`Task completed! Writing documentation...`)
      await runDocsCreation(ISSUE_ID)
      log(`Documentation ready. Now creating PR...`)
      await runPRCreation(ISSUE_ID)
      log(`${'═'.repeat(50)}`)
      log(`✅ Done! Issue ${ISSUE_ID} closed, docs written, and PR created.`)
      log(`${'═'.repeat(50)}`)
      process.exit(0)
    }

    if (result?.done && ISSUE_ID === 'all') {
      // Find closed epics and create PRs for them
      const closedEpics = getClosedEpics()
      if (closedEpics.length > 0) {
        log(`Found ${closedEpics.length} closed epic(s). Creating PRs...`)
        for (const epic of closedEpics) {
          log(`Processing epic: ${epic.id} - ${epic.title}`)
          ensureFeatureBranch(epic.id)
          await runDocsCreation(epic.id)
          await runPRCreation(epic.id)
        }
      }
      log(`${'═'.repeat(50)}`)
      log(`✅ All issues closed${closedEpics.length > 0 ? ` and ${closedEpics.length} PR(s) created` : ''}!`)
      log(`${'═'.repeat(50)}`)
      process.exit(0)
    }

    log(`Pausing 2s before next iteration...`)
    await new Promise(r => setTimeout(r, 2000))
  }

  log(`⚠️  Max iterations (${MAX_ITERATIONS}) reached.`)

  // Even if max iterations reached, try to create PR if issue was closed
  if (ISSUE_ID !== 'all' && checkDone() && !prCreated) {
    log(`Issue is closed, writing docs and creating PR before exit...`)
    if (!docsWritten) await runDocsCreation(ISSUE_ID)
    await runPRCreation(ISSUE_ID)
  }

  // For 'all' mode, check for closed epics
  if (ISSUE_ID === 'all' && !prCreated) {
    const closedEpics = getClosedEpics()
    if (closedEpics.length > 0) {
      log(`Found ${closedEpics.length} closed epic(s). Creating PRs...`)
      for (const epic of closedEpics) {
        ensureFeatureBranch(epic.id)
        await runDocsCreation(epic.id)
        await runPRCreation(epic.id)
      }
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
