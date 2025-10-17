/**
 * Sanitize error messages for user display
 * Prevents exposing database structure, table names, and internal logic
 */
export function getUserFriendlyError(error: any): string {
  // Don't log sensitive error details in production
  if (import.meta.env.DEV) {
    console.error('[Debug only]:', error);
  }
  
  // Handle specific error codes with generic messages
  if (error?.code === '23505') {
    return 'This record already exists';
  }
  
  if (error?.code === '23503') {
    return 'Unable to complete operation due to data dependency';
  }
  
  if (error?.code === '42501') {
    return 'Access denied';
  }
  
  // Generic RLS policy violations
  if (error?.message?.includes('RLS') || error?.message?.includes('policy')) {
    return 'Access denied';
  }
  
  // Generic foreign key violations
  if (error?.message?.includes('foreign key')) {
    return 'Unable to complete operation';
  }
  
  // Generic unique constraint violations
  if (error?.message?.includes('unique constraint')) {
    return 'This record already exists';
  }
  
  // Network errors
  if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
    return 'Network error. Please check your connection';
  }
  
  // Default generic message
  return 'An error occurred. Please try again';
}
