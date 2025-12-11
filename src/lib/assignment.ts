/**
 * Assignment Helper Module
 * 
 * Centralized read-only helpers for understanding lead, appointment, and task assignment.
 * These functions DO NOT write to the database - they only read and interpret existing fields.
 * 
 * ASSIGNMENT FIELD REFERENCE:
 * 
 * APPOINTMENTS TABLE:
 * - setter_id: UUID of the setter assigned to this appointment (the person who confirms/follows up)
 * - setter_name: Display name of the setter (denormalized for convenience)
 * - closer_id: UUID of the closer assigned to this appointment (the person who runs the call)
 * - closer_name: Display name of the closer (denormalized for convenience)
 * - assignment_source: How the appointment was assigned ('manual_claim', 'auto_assign', 'webhook', etc.)
 * 
 * CONFIRMATION_TASKS TABLE:
 * - assigned_to: UUID of the user this task is currently assigned to
 * - assigned_at: Timestamp when the task was assigned
 * - assigned_role: The role this task targets ('setter', 'closer', 'admin', etc.)
 * - routing_mode: How this task routes to users ('round_robin', 'manual', 'auto_chained', etc.)
 * - auto_return_at: Timestamp when task will return to queue if not completed (2 hours after claim)
 * - claimed_manually: Boolean indicating if task was manually claimed vs auto-assigned
 * 
 * CLAIM LOGIC (what happens when a user claims a task):
 * 1. Task's assigned_to is set to the claiming user's ID
 * 2. Task's assigned_at is set to current time
 * 3. Task's auto_return_at is set to 2 hours from now (auto-release if not completed)
 * 4. Task's claimed_manually is set to true
 * 5. IF the appointment has NO setter AND NO closer:
 *    - Appointment's setter_id is set to the claiming user
 *    - Appointment's assignment_source is set to 'manual_claim'
 * 6. Activity log is created with action 'Task Claimed & Assigned'
 */

// ============ APPOINTMENT ASSIGNMENT HELPERS ============

/**
 * Get the setter ID from an appointment.
 * The setter is typically the person who confirms the appointment and handles initial contact.
 * 
 * @param appointment - An appointment object with setter_id field
 * @returns The setter's user ID, or null if unassigned
 */
export function getAppointmentSetterId(appointment: { setter_id?: string | null }): string | null {
  return appointment.setter_id ?? null;
}

/**
 * Get the closer ID from an appointment.
 * The closer is the person who runs the actual call and closes the deal.
 * 
 * @param appointment - An appointment object with closer_id field
 * @returns The closer's user ID, or null if unassigned
 */
export function getAppointmentCloserId(appointment: { closer_id?: string | null }): string | null {
  return appointment.closer_id ?? null;
}

/**
 * Get the setter name from an appointment.
 * This is a denormalized field for display convenience.
 * 
 * @param appointment - An appointment object with setter_name field
 * @returns The setter's display name, or null if unassigned
 */
export function getAppointmentSetterName(appointment: { setter_name?: string | null }): string | null {
  return appointment.setter_name ?? null;
}

/**
 * Get the closer name from an appointment.
 * This is a denormalized field for display convenience.
 * 
 * @param appointment - An appointment object with closer_name field
 * @returns The closer's display name, or null if unassigned
 */
export function getAppointmentCloserName(appointment: { closer_name?: string | null }): string | null {
  return appointment.closer_name ?? null;
}

/**
 * Check if an appointment is assigned to a specific user (as setter OR closer).
 * Used for filtering "my" appointments in schedule views.
 * 
 * @param appointment - An appointment object with setter_id and closer_id fields
 * @param userId - The user ID to check
 * @returns True if the user is either the setter or closer for this appointment
 */
export function isAppointmentAssignedToUser(
  appointment: { setter_id?: string | null; closer_id?: string | null },
  userId: string
): boolean {
  return appointment.setter_id === userId || appointment.closer_id === userId;
}

/**
 * Check if an appointment has any assignment (setter or closer).
 * Appointments with no assignment show in "unassigned" queues.
 * 
 * @param appointment - An appointment object with setter_id and closer_id fields
 * @returns True if either setter or closer is assigned
 */
export function isAppointmentAssigned(
  appointment: { setter_id?: string | null; closer_id?: string | null }
): boolean {
  return appointment.setter_id != null || appointment.closer_id != null;
}

/**
 * Check if an appointment is fully unassigned (no setter AND no closer).
 * This is the condition that allows claiming to also set the setter_id.
 * 
 * @param appointment - An appointment object with setter_id and closer_id fields
 * @returns True if both setter and closer are null/undefined
 */
export function isAppointmentFullyUnassigned(
  appointment: { setter_id?: string | null; closer_id?: string | null }
): boolean {
  return appointment.setter_id == null && appointment.closer_id == null;
}

// ============ TASK ASSIGNMENT HELPERS ============

/**
 * Get the assignee ID from a task.
 * The assignee is the user currently responsible for completing this task.
 * 
 * @param task - A task object with assigned_to field
 * @returns The assignee's user ID, or null if unassigned (in queue)
 */
export function getTaskAssigneeId(task: { assigned_to?: string | null }): string | null {
  return task.assigned_to ?? null;
}

/**
 * Get the target role for a task.
 * This indicates which role type the task should be routed to.
 * 
 * @param task - A task object with assigned_role field
 * @returns The target role ('setter', 'closer', etc.), or null if not specified
 */
export function getTaskAssignedRole(task: { assigned_role?: string | null }): string | null {
  return task.assigned_role ?? null;
}

/**
 * Check if a task is assigned to a specific user.
 * Used for filtering "my" tasks in task views.
 * 
 * @param task - A task object with assigned_to field
 * @param userId - The user ID to check
 * @returns True if the task is assigned to this user
 */
export function isTaskAssignedToUser(task: { assigned_to?: string | null }, userId: string): boolean {
  return task.assigned_to === userId;
}

/**
 * Check if a task is in the queue (unassigned).
 * Queue tasks can be claimed by any eligible user.
 * 
 * @param task - A task object with assigned_to field
 * @returns True if the task has no assignee
 */
export function isTaskInQueue(task: { assigned_to?: string | null }): boolean {
  return task.assigned_to == null;
}

/**
 * Check if a task was manually claimed (vs auto-assigned).
 * Manually claimed tasks have different auto-return behavior.
 * 
 * @param task - A task object with claimed_manually field
 * @returns True if the task was manually claimed
 */
export function wasTaskManuallyClaimed(task: { claimed_manually?: boolean | null }): boolean {
  return task.claimed_manually === true;
}

// ============ COMBINED HELPERS ============

/**
 * Get the primary owner ID for a lead/appointment.
 * Priority: closer_id > setter_id > null
 * The closer is considered the "primary" owner because they ultimately close the deal.
 * 
 * @param appointment - An appointment object with closer_id and setter_id fields
 * @returns The primary owner's user ID, or null if completely unassigned
 */
export function getLeadPrimaryOwnerId(
  appointment: { closer_id?: string | null; setter_id?: string | null }
): string | null {
  // Closer takes priority as the "owner" who closes the deal
  return appointment.closer_id ?? appointment.setter_id ?? null;
}

/**
 * Get a display name for the appointment assignee.
 * Returns closer name if assigned, otherwise setter name, otherwise "Unassigned".
 * 
 * @param appointment - An appointment with name fields
 * @returns A display string for the assignee
 */
export function getAppointmentAssigneeDisplayName(
  appointment: { closer_name?: string | null; setter_name?: string | null }
): string {
  return appointment.closer_name ?? appointment.setter_name ?? "Unassigned";
}

/**
 * Get a display name for the task assignee.
 * Falls back to "Unassigned" if no assignee name provided.
 * 
 * @param task - A task with optional assignee_name field
 * @returns A display string for the assignee
 */
export function getTaskAssigneeDisplayName(task: { assignee_name?: string | null }): string {
  return task.assignee_name ?? "Unassigned";
}
