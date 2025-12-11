# Project Structure Guidelines

## Feature-Based Organization

This project follows a feature-based file structure. Each major feature should be self-contained:

- authentication
etc..

Always refer to the Architecture.md before creating/ editing files

## Documentation Requirements

### 1. Feature Documentation
For each feature, create a corresponding `.md` file that documents:
- **Data flow**: How data moves through the feature
- **Data Schema**: Document relevant schemas
- **Backend interactions**: API endpoints, database queries, external services
- **Component architecture**: Key components and their relationships, including configurations
- **Business logic**: Core functionality explained in plain language

**Important**: These `.md` files should be **iteratively updated** as we code. Don't wait until the feature is complete—update the documentation alongside code changes to keep it accurate and current.

### 2. Code File Headers
Every code file must include a header comment referencing its documentation:
```javascript
/**
 * Feature: CV Upload and Parser
 * Documentation: docs/cv-upload-parser.md
 * 
 * Brief description of this file's purpose
 */
```

### 3. Code Comments
Add clear, meaningful comments throughout your code:

- **Function/method comments**: Explain what it does, parameters, and return values
- **Complex logic**: Add inline comments for non-obvious code sections
- **Business rules**: Document why certain decisions were made
- **TODOs**: Mark future improvements or known issues

Example:
```javascript
/**
 * Parses CV file and extracts structured data
 * @param {File} cvFile - The uploaded CV file (PDF or DOCX)
 * @returns {Object} Parsed CV data with sections: contact, experience, education
 * @throws {Error} If file format is unsupported
 */
async function parseCV(cvFile) {
  // Check file type before processing to avoid unnecessary parsing attempts
  if (!isSupportedFormat(cvFile)) {
    throw new Error('Unsupported file format');
  }
  
  // TODO: Add support for .txt files in future iteration
  // ...
}
```

### 4. Audit Trail
Maintain clear traceability between:
- User actions → Frontend components → API calls → Backend logic → Database changes
- Document this flow in each feature's `.md` file

## File Naming Convention
- Feature docs: `docs/[feature-name].md` (e.g., `docs/cv-upload-parser.md`)
- Code files: Follow standard conventions for your framework/language

## Development Workflow
1. Start coding a feature
2. Create/update the corresponding `.md` file as you build
3. Add proper headers to all new code files
4. Write clear comments for functions and complex logic
5. Keep documentation in sync with code changes throughout development

---

When implementing new features or modifying existing ones, always update the corresponding documentation to maintain accuracy.

## Error Handling & Logging

### Error Handling
- Wrap critical operations in try-catch blocks
- Provide meaningful error messages to users
- Log errors with sufficient context for debugging
- Define error codes/types for consistency across features

### Logging
- Log key user actions and system events
- Include timestamps, user IDs, and relevant context
- Use appropriate log levels: DEBUG, INFO, WARN, ERROR
- Never log sensitive data (passwords, tokens, personal info)

## Testing Requirements

- Write unit tests for business logic and utilities
- Include integration tests for API endpoints
- Test edge cases and error scenarios
- Aim for meaningful test coverage, not just high percentages
- Document test scenarios in feature `.md` files

## Code Quality Standards

### Naming Conventions
- Use descriptive, self-documenting variable and function names
- Follow consistent naming patterns (camelCase, PascalCase, etc.)
- Avoid abbreviations unless widely understood

### Code Organization
- Keep functions small and focused (single responsibility)
- Avoid deep nesting (max 3-4 levels)
- Extract repeated logic into reusable utilities
- Separate business logic from UI logic

### Dependencies
- Document why each major dependency was chosen
- Keep dependencies up to date
- Avoid adding unnecessary packages

## Security Considerations

- Validate and sanitize all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Never commit secrets, API keys, or credentials to version control
- Document security-sensitive areas in code comments

## API Design

- Use RESTful conventions for endpoints
- Return consistent response structures
- Include proper HTTP status codes
- Version your APIs (e.g., `/api/v1/...`)
- Document all endpoints with request/response examples

## Database

- Document schema changes in migration files
- Add comments to complex queries
- Use indexes appropriately for performance
- Document relationships between tables
- Keep a changelog of database modifications

## Performance Considerations

- Identify and document potential bottlenecks
- Optimize database queries (avoid N+1 problems)
- Implement caching where appropriate
- Consider pagination for large datasets
- Document performance decisions in feature `.md` files

## Git Workflow

- Write clear, descriptive commit messages
- Reference feature docs in commit messages when relevant
- Keep commits focused and atomic
- Create feature branches for new work
- Review code before merging to main

## Environment Configuration

- Use environment variables for configuration
- Document all required environment variables
- Provide `.env.example` template
- Never commit actual `.env` files

## Accessibility & UX

- Ensure UI is keyboard navigable
- Add appropriate ARIA labels
- Provide loading states and feedback
- Handle empty states gracefully
- Test on different screen sizes
- Ensure the UI & UX is modern and up to industry practice