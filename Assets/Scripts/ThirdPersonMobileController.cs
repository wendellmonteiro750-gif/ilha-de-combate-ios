using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class ThirdPersonMobileController : MonoBehaviour
{
    [SerializeField] private VirtualJoystick joystick;
    [SerializeField] private Transform cameraTransform;
    [SerializeField] private Animator animator;
    [SerializeField] private float walkSpeed = 3.5f;
    [SerializeField] private float runSpeed = 5.5f;
    [SerializeField] private float rotationSpeed = 12f;
    [SerializeField] private float gravity = -20f;
    private CharacterController controller;
    private float verticalVelocity;

    private void Awake() => controller = GetComponent<CharacterController>();

    private void Update()
    {
        Vector2 input = joystick ? joystick.Direction : new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        Vector3 forward = cameraTransform ? cameraTransform.forward : Vector3.forward;
        Vector3 right = cameraTransform ? cameraTransform.right : Vector3.right;
        forward.y = 0; right.y = 0;
        forward.Normalize(); right.Normalize();
        Vector3 move = Vector3.ClampMagnitude(forward * input.y + right * input.x, 1f);
        bool running = Input.GetKey(KeyCode.LeftShift);
        float speed = running ? runSpeed : walkSpeed;
        controller.Move(move * speed * Time.deltaTime);
        if (move.sqrMagnitude > 0.01f)
        {
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(move), rotationSpeed * Time.deltaTime);
        }
        if (controller.isGrounded && verticalVelocity < 0) verticalVelocity = -2f;
        verticalVelocity += gravity * Time.deltaTime;
        controller.Move(Vector3.up * verticalVelocity * Time.deltaTime);
        if (animator)
        {
            animator.SetFloat("Speed", move.magnitude * (running ? 1.5f : 1f));
        }
    }

    // Connect this method to the UI jump button's OnClick event.
    public void Jump(float jumpHeight = 1.4f)
    {
        if (controller.isGrounded) verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * gravity);
    }
}
