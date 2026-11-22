using UnityEngine;

public class ThirdPersonCameraFollow : MonoBehaviour
{
    [SerializeField] private Transform target;
    [SerializeField] private Vector3 offset = new Vector3(0f, 2.2f, -4.5f);
    [SerializeField] private float followSpeed = 10f;
    [SerializeField] private float lookHeight = 1.4f;
    private void LateUpdate()
    {
        if (!target) return;
        Vector3 desired = target.position + target.TransformDirection(offset);
        transform.position = Vector3.Lerp(transform.position, desired, followSpeed * Time.deltaTime);
        Vector3 lookPoint = target.position + Vector3.up * lookHeight;
        transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(lookPoint - transform.position), followSpeed * Time.deltaTime);
    }
}
